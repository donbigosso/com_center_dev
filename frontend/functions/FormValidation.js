/**
 * Central frontend form validation.
 * Constraints live in VALIDATION_CONSTRAINTS so rules are easy to find and change.
 * Validators return { valid: boolean, error: string }.
 */

export const VALIDATION_CONSTRAINTS = {
  // Username
  usernameMinLength: 4,
  usernameMaxLength: 16,
  usernameRegex: /^[a-zA-Z0-9_]{4,16}$/,
  usernamePatternHint: "4–16 characters: letters, numbers, and underscore only",

  // Password
  passwordMinLength: 10,
  // No hard max in current app rules; keep null = unlimited
  passwordMaxLength: null,
  passwordRegex: /^(?=.*[A-Z])(?=.*\d).{10,}$/,
  passwordPatternHint:
    "at least 10 characters, one uppercase letter, and one number",

  // Gallery
  galleryTitleMinLength: 3,
  galleryTitleMaxLength: 200,
  galleryDescriptionMinLength: 0,
  galleryDescriptionMaxLength: 255,

  // File rename
  filenameMinLength: 5,
  filenameMaxLength: 50,
  filenameRegex: /^[a-zA-Z0-9._\-\s]{5,50}$/,
  filenamePatternHint:
    "5–50 characters: letters, numbers, dots, hyphens, underscores, and spaces",
};

function pass() {
  return { valid: true, error: "" };
}

function fail(error) {
  return { valid: false, error: String(error || "Validation failed.") };
}

/**
 * @param {unknown} value
 * @param {string} [fieldLabel]
 * @returns {{valid: boolean, error: string}}
 */
export function validateRequired(value, fieldLabel = "This field") {
  if (value === null || value === undefined) {
    return fail(`${fieldLabel} is required.`);
  }
  if (typeof value === "string" && value.trim() === "") {
    return fail(`${fieldLabel} is required.`);
  }
  return pass();
}

/**
 * @param {string} username
 * @returns {{valid: boolean, error: string}}
 */
export function validateUsername(username) {
  const c = VALIDATION_CONSTRAINTS;
  const value = username == null ? "" : String(username).trim();

  if (!value) {
    return fail("Username is required.");
  }
  if (value.length < c.usernameMinLength) {
    return fail(
      `Username must be at least ${c.usernameMinLength} characters.`
    );
  }
  if (value.length > c.usernameMaxLength) {
    return fail(
      `Username must be at most ${c.usernameMaxLength} characters.`
    );
  }
  if (!c.usernameRegex.test(value)) {
    return fail(`Username is invalid (${c.usernamePatternHint}).`);
  }
  return pass();
}

/**
 * @param {string} password
 * @returns {{valid: boolean, error: string}}
 */
export function validatePassword(password) {
  const c = VALIDATION_CONSTRAINTS;
  const value = password == null ? "" : String(password);

  if (!value) {
    return fail("Password is required.");
  }
  if (value.length < c.passwordMinLength) {
    return fail(
      `Password must be at least ${c.passwordMinLength} characters.`
    );
  }
  if (
    c.passwordMaxLength != null &&
    value.length > c.passwordMaxLength
  ) {
    return fail(
      `Password must be at most ${c.passwordMaxLength} characters.`
    );
  }
  if (!c.passwordRegex.test(value)) {
    return fail(`Password is invalid (${c.passwordPatternHint}).`);
  }
  return pass();
}

/**
 * Username + password (e.g. login / create user).
 * @returns {{valid: boolean, error: string}}
 */
export function validateUsernameAndPassword(username, password) {
  const userResult = validateUsername(username);
  if (!userResult.valid) return userResult;

  const passResult = validatePassword(password);
  if (!passResult.valid) return passResult;

  return pass();
}

/**
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {{valid: boolean, error: string}}
 */
export function validatePasswordMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return fail("Passwords do not match.");
  }
  return pass();
}

/**
 * Full create-user style check: username, password strength, confirm match.
 * @returns {{valid: boolean, error: string}}
 */
export function validateUserRegistration(username, password, confirmPassword) {
  if (!String(username || "").trim() || !password) {
    return fail("Please fill in all fields.");
  }
  const creds = validateUsernameAndPassword(username, password);
  if (!creds.valid) return creds;

  if (confirmPassword !== undefined) {
    const match = validatePasswordMatch(password, confirmPassword);
    if (!match.valid) return match;
  }
  return pass();
}

/**
 * @param {string} title
 * @returns {{valid: boolean, error: string}}
 */
export function validateGalleryTitle(title) {
  const c = VALIDATION_CONSTRAINTS;
  const value = title == null ? "" : String(title).trim();

  if (value.length < c.galleryTitleMinLength) {
    return fail(
      `Title must be at least ${c.galleryTitleMinLength} characters.`
    );
  }
  if (value.length > c.galleryTitleMaxLength) {
    return fail(
      `Title must be at most ${c.galleryTitleMaxLength} characters.`
    );
  }
  return pass();
}

/**
 * @param {string} description
 * @returns {{valid: boolean, error: string}}
 */
export function validateGalleryDescription(description) {
  const c = VALIDATION_CONSTRAINTS;
  const value = description == null ? "" : String(description).trim();

  if (value.length > c.galleryDescriptionMaxLength) {
    return fail(
      `Description must be at most ${c.galleryDescriptionMaxLength} characters.`
    );
  }
  return pass();
}

/**
 * @param {string} title
 * @param {string} description
 * @returns {{valid: boolean, error: string}}
 */
export function validateGallery(title, description) {
  const titleResult = validateGalleryTitle(title);
  if (!titleResult.valid) return titleResult;

  const descResult = validateGalleryDescription(description);
  if (!descResult.valid) return descResult;

  return pass();
}

/**
 * @param {string} filename
 * @returns {{valid: boolean, error: string}}
 */
export function validateFilename(filename) {
  const c = VALIDATION_CONSTRAINTS;
  const value = filename == null ? "" : String(filename);

  if (!value) {
    return fail("Filename is required.");
  }
  if (value.length < c.filenameMinLength) {
    return fail(
      `Filename must be at least ${c.filenameMinLength} characters.`
    );
  }
  if (value.length > c.filenameMaxLength) {
    return fail(
      `Filename must be at most ${c.filenameMaxLength} characters.`
    );
  }
  if (!c.filenameRegex.test(value)) {
    return fail(`Filename is invalid (${c.filenamePatternHint}).`);
  }
  return pass();
}

/**
 * Admin / UI: user must be selected from a list.
 * @param {string} username
 * @returns {{valid: boolean, error: string}}
 */
export function validateUserSelected(username) {
  if (!username || !String(username).trim()) {
    return fail("Please select a user.");
  }
  return pass();
}

/**
 * Delete confirmation: typed name must match selected name.
 * @returns {{valid: boolean, error: string}}
 */
export function validateDeleteUserConfirmation(selectedUser, confirmedUser) {
  const selected = validateUserSelected(selectedUser);
  if (!selected.valid) return selected;

  if (!confirmedUser || !String(confirmedUser).trim()) {
    return fail("Please type the username to confirm.");
  }
  if (String(selectedUser).trim() !== String(confirmedUser).trim()) {
    return fail("Username does not match.");
  }
  return pass();
}

/**
 * Password change form: selected user + new password + confirm.
 * @returns {{valid: boolean, error: string}}
 */
export function validatePasswordChange(username, password, confirmPassword) {
  const user = validateUserSelected(username);
  if (!user.valid) return user;

  if (!password) {
    return fail("Please enter a new password.");
  }
  const passResult = validatePassword(password);
  if (!passResult.valid) return passResult;

  return validatePasswordMatch(password, confirmPassword);
}
