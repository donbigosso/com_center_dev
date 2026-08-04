<?php

/**
 * Image processing for gallery media uploads.
 *
 * Resolution / quality knobs are defined at the top of this class and can also
 * be overridden with environment variables (easy to tune later):
 *
 *   MEDIA_FULL_MAX_LONG_SIDE   default 1920
 *   MEDIA_MINI_MAX_LONG_SIDE   default 300
 *   MEDIA_JPEG_QUALITY         default 88
 *   MEDIA_WATERMARK_TEXT       default "Donbigosso Galleries"
 *   MEDIA_WATERMARK_FONT       optional absolute path to a .ttf
 *
 * Adapted from junk/ImageManipulatorNew.php and junk/ImageManipulator.php
 * (resize-by-long-side, EXIF GPS → decimal, bottom-right watermark).
 */
class ImageManipulator
{
    // -------------------------------------------------------------------------
    // Easy-to-adjust defaults (env vars override these)
    // -------------------------------------------------------------------------
    public const DEFAULT_FULL_MAX_LONG_SIDE = 1920;
    public const DEFAULT_MINI_MAX_LONG_SIDE = 400;
    public const DEFAULT_JPEG_QUALITY = 88;
    public const DEFAULT_WATERMARK_TEXT = 'Donbigosso Galleries';

    private int $fullMaxLongSide;
    private int $miniMaxLongSide;
    private int $jpegQuality;
    private string $watermarkText;
    private ?string $fontPath;

    /** @var \GdImage|resource|null */
    private $sourceImage = null;

    /** @var \GdImage|resource|null */
    private $workImage = null;

    private int $originalWidth = 0;
    private int $originalHeight = 0;

    /** @var array|false|null */
    private $exifData = null;

    public function __construct()
    {
        $this->fullMaxLongSide = max(
            1,
            (int)(getenv('MEDIA_FULL_MAX_LONG_SIDE') ?: self::DEFAULT_FULL_MAX_LONG_SIDE)
        );
        $this->miniMaxLongSide = max(
            1,
            (int)(getenv('MEDIA_MINI_MAX_LONG_SIDE') ?: self::DEFAULT_MINI_MAX_LONG_SIDE)
        );
        $this->jpegQuality = max(
            1,
            min(100, (int)(getenv('MEDIA_JPEG_QUALITY') ?: self::DEFAULT_JPEG_QUALITY))
        );
        $wm = getenv('MEDIA_WATERMARK_TEXT');
        $this->watermarkText = ($wm !== false && trim((string)$wm) !== '')
            ? trim((string)$wm)
            : self::DEFAULT_WATERMARK_TEXT;

        $envFont = getenv('MEDIA_WATERMARK_FONT');
        $this->fontPath = $this->resolveFontPath(
            ($envFont !== false && trim((string)$envFont) !== '')
                ? trim((string)$envFont)
                : null
        );
    }

    public function getFullMaxLongSide(): int
    {
        return $this->fullMaxLongSide;
    }

    public function getMiniMaxLongSide(): int
    {
        return $this->miniMaxLongSide;
    }

    public function getJpegQuality(): int
    {
        return $this->jpegQuality;
    }

    public function getWatermarkText(): string
    {
        return $this->watermarkText;
    }

    /**
     * Load an image from a filesystem path (jpeg/png/gif/webp).
     * Also reads EXIF when available (before re-encode loses it).
     */
    public function loadFromFile(string $path): bool
    {
        $this->destroy();

        if (!is_file($path) || !is_readable($path)) {
            return false;
        }

        if (function_exists('exif_read_data')) {
            $exif = @exif_read_data($path, 'ANY_TAG', true);
            $this->exifData = is_array($exif) ? $exif : null;
        }

        $info = @getimagesize($path);
        if ($info === false) {
            return false;
        }

        $type = $info[2] ?? 0;
        $image = null;

        switch ($type) {
            case IMAGETYPE_JPEG:
                $image = @imagecreatefromjpeg($path);
                break;
            case IMAGETYPE_PNG:
                $image = @imagecreatefrompng($path);
                break;
            case IMAGETYPE_GIF:
                $image = @imagecreatefromgif($path);
                break;
            case IMAGETYPE_WEBP:
                if (function_exists('imagecreatefromwebp')) {
                    $image = @imagecreatefromwebp($path);
                }
                break;
            default:
                return false;
        }

        if (!$image) {
            return false;
        }

        // Flatten alpha onto white for consistent JPEG output
        $this->sourceImage = $this->flattenToTrueColor($image);
        if ($image !== $this->sourceImage) {
            imagedestroy($image);
        }

        $this->originalWidth = imagesx($this->sourceImage);
        $this->originalHeight = imagesy($this->sourceImage);
        $this->workImage = $this->sourceImage;

        $this->applyExifOrientation();

        return true;
    }

    /**
     * Resize working image so the longer side is at most $maxLongSide.
     * Does nothing if already smaller.
     */
    public function resizeIfLongerSideExceeds(int $maxLongSide): void
    {
        if (!$this->workImage) {
            return;
        }

        $w = imagesx($this->workImage);
        $h = imagesy($this->workImage);
        $long = max($w, $h);

        if ($long <= $maxLongSide) {
            return;
        }

        if ($w >= $h) {
            $newW = $maxLongSide;
            $newH = max(1, (int)round($h * ($newW / $w)));
        } else {
            $newH = $maxLongSide;
            $newW = max(1, (int)round($w * ($newH / $h)));
        }

        $resized = imagecreatetruecolor($newW, $newH);
        imagecopyresampled($resized, $this->workImage, 0, 0, 0, 0, $newW, $newH, $w, $h);

        if ($this->workImage !== $this->sourceImage) {
            imagedestroy($this->workImage);
        }
        $this->workImage = $resized;
    }

    /**
     * Add watermark text to the bottom-right of the working image.
     * Uses TTF when a font is available; falls back to imagestring.
     */
    public function addWatermarkBottomRight(?string $text = null): void
    {
        if (!$this->workImage) {
            return;
        }

        $text = $text !== null && $text !== '' ? $text : $this->watermarkText;
        $w = imagesx($this->workImage);
        $h = imagesy($this->workImage);
        $padding = max(8, (int)round(min($w, $h) * 0.02));

        // Skip tiny images (e.g. broken uploads)
        if ($w < 120 || $h < 40) {
            return;
        }

        $white = imagecolorallocate($this->workImage, 255, 255, 255);
        $shadow = imagecolorallocate($this->workImage, 0, 0, 0);

        if ($this->fontPath && function_exists('imagettftext')) {
            $fontSize = max(10, min(22, (int)round($w * 0.018)));
            $bbox = imagettfbbox($fontSize, 0, $this->fontPath, $text);
            if ($bbox !== false) {
                $textW = abs($bbox[2] - $bbox[0]);
                $textH = abs($bbox[7] - $bbox[1]);
                $x = $w - $textW - $padding;
                $y = $h - $padding;

                // simple outline / stroke
                for ($ox = -1; $ox <= 1; $ox++) {
                    for ($oy = -1; $oy <= 1; $oy++) {
                        if ($ox === 0 && $oy === 0) {
                            continue;
                        }
                        imagettftext(
                            $this->workImage,
                            $fontSize,
                            0,
                            $x + $ox,
                            $y + $oy,
                            $shadow,
                            $this->fontPath,
                            $text
                        );
                    }
                }
                imagettftext(
                    $this->workImage,
                    $fontSize,
                    0,
                    $x,
                    $y,
                    $white,
                    $this->fontPath,
                    $text
                );
                return;
            }
        }

        // Built-in bitmap font fallback (font 2–5)
        $font = 3;
        $textW = imagefontwidth($font) * strlen($text);
        $textH = imagefontheight($font);
        $x = max(0, $w - $textW - $padding);
        $y = max(0, $h - $textH - $padding);
        imagestring($this->workImage, $font, $x + 1, $y + 1, $text, $shadow);
        imagestring($this->workImage, $font, $x, $y, $text, $white);
    }

    /**
     * Save current working image as JPEG.
     */
    public function saveJpeg(string $destinationPath, ?int $quality = null): bool
    {
        if (!$this->workImage) {
            return false;
        }
        $quality = $quality ?? $this->jpegQuality;
        $dir = dirname($destinationPath);
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
                return false;
            }
        }
        return imagejpeg($this->workImage, $destinationPath, $quality);
    }

    /**
     * Create a miniature JPEG (long side ≤ mini max) from the current full work image.
     * Does not change the working full-size image permanently.
     */
    public function saveMiniatureJpeg(string $destinationPath, ?int $maxLongSide = null): bool
    {
        if (!$this->workImage) {
            return false;
        }

        $maxLongSide = $maxLongSide ?? $this->miniMaxLongSide;
        $w = imagesx($this->workImage);
        $h = imagesy($this->workImage);
        $long = max($w, $h);

        if ($long > $maxLongSide) {
            if ($w >= $h) {
                $newW = $maxLongSide;
                $newH = max(1, (int)round($h * ($newW / $w)));
            } else {
                $newH = $maxLongSide;
                $newW = max(1, (int)round($w * ($newH / $h)));
            }
        } else {
            $newW = $w;
            $newH = $h;
        }

        $mini = imagecreatetruecolor($newW, $newH);
        imagecopyresampled($mini, $this->workImage, 0, 0, 0, 0, $newW, $newH, $w, $h);

        $dir = dirname($destinationPath);
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
                imagedestroy($mini);
                return false;
            }
        }

        $ok = imagejpeg($mini, $destinationPath, $this->jpegQuality);
        imagedestroy($mini);
        return $ok;
    }

    /**
     * Extract creation/capture datetime from EXIF for media_items.creation_date.
     * Prefer DateTimeOriginal, then DateTimeDigitized, then DateTime.
     * Returns MySQL datetime "Y-m-d H:i:s", or null if EXIF has no usable date.
     */
    public function getCreationDateFromExif(): ?string
    {
        if (!is_array($this->exifData)) {
            return null;
        }

        $candidates = [];

        // Sectioned format (exif_read_data with arrays=true)
        if (isset($this->exifData['EXIF']) && is_array($this->exifData['EXIF'])) {
            $candidates[] = $this->exifData['EXIF']['DateTimeOriginal'] ?? null;
            $candidates[] = $this->exifData['EXIF']['DateTimeDigitized'] ?? null;
        }
        if (isset($this->exifData['IFD0']) && is_array($this->exifData['IFD0'])) {
            $candidates[] = $this->exifData['IFD0']['DateTime'] ?? null;
        }

        // Flat keys
        $candidates[] = $this->exifData['DateTimeOriginal'] ?? null;
        $candidates[] = $this->exifData['DateTimeDigitized'] ?? null;
        $candidates[] = $this->exifData['DateTime'] ?? null;

        foreach ($candidates as $raw) {
            $normalized = $this->normalizeExifDatetime($raw);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        return null;
    }

    /**
     * Convert EXIF datetime strings (e.g. "2024:03:15 14:30:00") to MySQL format.
     * @param mixed $raw
     */
    private function normalizeExifDatetime($raw): ?string
    {
        if ($raw === null) {
            return null;
        }
        $value = trim((string)$raw);
        if ($value === '' || str_starts_with($value, '0000')) {
            return null;
        }

        // EXIF standard: "YYYY:MM:DD HH:MM:SS"
        if (preg_match(
            '/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/',
            $value,
            $m
        )) {
            $dt = sprintf('%s-%s-%s %s:%s:%s', $m[1], $m[2], $m[3], $m[4], $m[5], $m[6]);
            $check = \DateTime::createFromFormat('Y-m-d H:i:s', $dt);
            if ($check instanceof \DateTime) {
                return $check->format('Y-m-d H:i:s');
            }
        }

        // Fallback: strtotime-friendly variants
        $valueAlt = str_replace(':', '-', substr($value, 0, 10)) . substr($value, 10);
        $ts = strtotime($valueAlt);
        if ($ts !== false) {
            return date('Y-m-d H:i:s', $ts);
        }

        return null;
    }

    /**
     * Extract GPS coordinates from EXIF as decimal degrees JSON string, or null.
     * Stored shape: {"latitude":"12.345678","longitude":"-98.765432"}
     */
    public function getDecimalCoordinatesJson(): ?string
    {
        $coords = $this->getDecimalCoordinates();
        if ($coords === null) {
            return null;
        }
        return json_encode($coords, JSON_UNESCAPED_UNICODE);
    }

    /**
     * @return array{latitude:string,longitude:string}|null
     */
    public function getDecimalCoordinates(): ?array
    {
        if (!is_array($this->exifData)) {
            return null;
        }

        // Prefer SECTION format from exif_read_data(..., true)
        $gps = $this->exifData['GPS'] ?? null;
        if (!is_array($gps)) {
            // Flat keys
            if (!isset($this->exifData['GPSLatitude'], $this->exifData['GPSLongitude'])) {
                return null;
            }
            $gps = [
                'GPSLatitude' => $this->exifData['GPSLatitude'],
                'GPSLongitude' => $this->exifData['GPSLongitude'],
                'GPSLatitudeRef' => $this->exifData['GPSLatitudeRef'] ?? 'N',
                'GPSLongitudeRef' => $this->exifData['GPSLongitudeRef'] ?? 'E',
            ];
        }

        if (!isset($gps['GPSLatitude'], $gps['GPSLongitude'])) {
            return null;
        }

        $latRef = (string)($gps['GPSLatitudeRef'] ?? 'N');
        $lonRef = (string)($gps['GPSLongitudeRef'] ?? 'E');
        $lat = $this->exifCoordToDecimal((array)$gps['GPSLatitude'], $latRef);
        $lon = $this->exifCoordToDecimal((array)$gps['GPSLongitude'], $lonRef);

        if ($lat === null || $lon === null) {
            return null;
        }

        return [
            'latitude' => number_format($lat, 6, '.', ''),
            'longitude' => number_format($lon, 6, '.', ''),
        ];
    }

    public function destroy(): void
    {
        if ($this->workImage && $this->workImage !== $this->sourceImage) {
            @imagedestroy($this->workImage);
        }
        if ($this->sourceImage) {
            @imagedestroy($this->sourceImage);
        }
        $this->workImage = null;
        $this->sourceImage = null;
        $this->exifData = null;
        $this->originalWidth = 0;
        $this->originalHeight = 0;
    }

    public function __destruct()
    {
        $this->destroy();
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    private function resolveFontPath(?string $preferred): ?string
    {
        $candidates = array_filter([
            $preferred,
            __DIR__ . '/../fonts/DejaVuSans.ttf',
            __DIR__ . '/../fonts/MsMadi.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
        ]);

        foreach ($candidates as $path) {
            if (is_string($path) && is_file($path) && is_readable($path)) {
                return $path;
            }
        }
        return null;
    }

    /**
     * @param \GdImage|resource $image
     * @return \GdImage|resource
     */
    private function flattenToTrueColor($image)
    {
        $w = imagesx($image);
        $h = imagesy($image);
        $canvas = imagecreatetruecolor($w, $h);
        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefilledrectangle($canvas, 0, 0, $w, $h, $white);
        imagealphablending($canvas, true);
        imagecopy($canvas, $image, 0, 0, 0, 0, $w, $h);
        return $canvas;
    }

    private function applyExifOrientation(): void
    {
        if (!$this->workImage || !is_array($this->exifData)) {
            return;
        }

        $orientation = null;
        if (isset($this->exifData['IFD0']['Orientation'])) {
            $orientation = (int)$this->exifData['IFD0']['Orientation'];
        } elseif (isset($this->exifData['Orientation'])) {
            $orientation = (int)$this->exifData['Orientation'];
        }

        if (!$orientation || $orientation === 1) {
            return;
        }

        $rotated = null;
        switch ($orientation) {
            case 3:
                $rotated = imagerotate($this->workImage, 180, 0);
                break;
            case 6:
                $rotated = imagerotate($this->workImage, -90, 0);
                break;
            case 8:
                $rotated = imagerotate($this->workImage, 90, 0);
                break;
            default:
                return;
        }

        if ($rotated) {
            if ($this->workImage !== $this->sourceImage) {
                imagedestroy($this->workImage);
            }
            // Keep source reference if it was same resource
            if ($this->sourceImage === $this->workImage) {
                $this->sourceImage = $rotated;
            }
            $this->workImage = $rotated;
            $this->originalWidth = imagesx($this->workImage);
            $this->originalHeight = imagesy($this->workImage);
        }
    }

    /**
     * @param array<int,mixed> $coord
     */
    private function exifCoordToDecimal(array $coord, string $ref): ?float
    {
        if (count($coord) < 3) {
            return null;
        }

        $degrees = $this->exifRatioToFloat($coord[0]);
        $minutes = $this->exifRatioToFloat($coord[1]);
        $seconds = $this->exifRatioToFloat($coord[2]);

        if ($degrees === null || $minutes === null || $seconds === null) {
            return null;
        }

        $decimal = $degrees + ($minutes / 60.0) + ($seconds / 3600.0);
        $ref = strtoupper(trim($ref));
        if ($ref === 'S' || $ref === 'W') {
            $decimal *= -1;
        }
        return $decimal;
    }

    /**
     * @param mixed $value
     */
    private function exifRatioToFloat($value): ?float
    {
        if (is_numeric($value)) {
            return (float)$value;
        }
        if (is_string($value) && str_contains($value, '/')) {
            [$num, $den] = array_pad(explode('/', $value, 2), 2, '1');
            $den = (float)$den;
            if ($den == 0.0) {
                return null;
            }
            return ((float)$num) / $den;
        }
        return null;
    }
}
