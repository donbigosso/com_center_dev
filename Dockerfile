FROM php:8.2-apache

# System libs for GD (JPEG/PNG/FreeType) + fonts for image watermarks
RUN apt-get update && apt-get install -y --no-install-recommends \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libwebp-dev \
        fonts-dejavu-core \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) pdo pdo_mysql gd exif \
    && rm -rf /var/lib/apt/lists/*
