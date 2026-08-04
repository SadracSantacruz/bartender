import type { Deck, Serve } from "../types";

const VALID_SERVES: Serve[] = ["up", "rocks", "built", "blended", "shareable", "other"];

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  deck?: Deck;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function validateDrink(raw: unknown, index: number, seenIds: Set<string>): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `drinks[${index}]`;

  if (typeof raw !== "object" || raw === null) {
    errors.push({ path, message: "must be an object" });
    return errors;
  }
  const d = raw as Record<string, unknown>;

  if (!isNonEmptyString(d.id)) {
    errors.push({ path: `${path}.id`, message: "id is required and must be a non-empty string (slug)" });
  } else if (seenIds.has(d.id)) {
    errors.push({ path: `${path}.id`, message: `duplicate id "${d.id}" — id must be unique within the deck` });
  } else {
    seenIds.add(d.id);
  }

  if (!isNonEmptyString(d.name)) {
    errors.push({ path: `${path}.name`, message: "name is required and must be a non-empty string" });
  }

  if (typeof d.tier !== "number" || !Number.isFinite(d.tier)) {
    errors.push({ path: `${path}.tier`, message: "tier is required and must be a number (1, 2, or 3)" });
  }

  if (!isNonEmptyString(d.category)) {
    errors.push({ path: `${path}.category`, message: "category is required and must be a non-empty string" });
  }

  if (!isString(d.base)) {
    errors.push({ path: `${path}.base`, message: "base is required and must be a string" });
  }

  if (!Array.isArray(d.ingredients) || !d.ingredients.every(isString)) {
    errors.push({ path: `${path}.ingredients`, message: "ingredients is required and must be an array of strings" });
  }

  if (!isString(d.glass)) {
    errors.push({ path: `${path}.glass`, message: "glass is required and must be a string" });
  }

  if (!isString(d.serve) || !VALID_SERVES.includes(d.serve as Serve)) {
    errors.push({
      path: `${path}.serve`,
      message: `serve is required and must be one of: ${VALID_SERVES.join(", ")}`,
    });
  }

  if (!isString(d.rim)) {
    errors.push({ path: `${path}.rim`, message: 'rim is required and must be a string (use "none" if there is no rim)' });
  }

  if (!isString(d.garnish)) {
    errors.push({
      path: `${path}.garnish`,
      message: 'garnish is required and must be a string (use "none listed" if not specified)',
    });
  }

  if (!isString(d.prep)) {
    errors.push({ path: `${path}.prep`, message: "prep is required and must be a string" });
  }

  if (d.notes !== undefined && !isString(d.notes)) {
    errors.push({ path: `${path}.notes`, message: "notes must be a string if present" });
  }

  if (d.verify !== undefined && !isString(d.verify)) {
    errors.push({ path: `${path}.verify`, message: "verify must be a string if present" });
  }

  return errors;
}

export function validateDeck(raw: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { valid: false, errors: [{ path: "$", message: "deck must be a JSON object" }] };
  }
  const deck = raw as Record<string, unknown>;

  if (!isNonEmptyString(deck.id)) {
    errors.push({ path: "id", message: "id is required and must be a non-empty string (slug)" });
  }
  if (!isNonEmptyString(deck.name)) {
    errors.push({ path: "name", message: "name is required and must be a non-empty string" });
  }
  if (!isString(deck.description)) {
    errors.push({ path: "description", message: "description is required and must be a string" });
  }
  if (typeof deck.tierLabels !== "object" || deck.tierLabels === null) {
    errors.push({ path: "tierLabels", message: "tierLabels is required and must be an object mapping tier numbers to labels" });
  }
  if (!Array.isArray(deck.drinks)) {
    errors.push({ path: "drinks", message: "drinks is required and must be an array" });
  } else {
    const seenIds = new Set<string>();
    deck.drinks.forEach((raw, i) => {
      errors.push(...validateDrink(raw, i, seenIds));
    });
    if (deck.drinks.length === 0) {
      errors.push({ path: "drinks", message: "deck must contain at least one drink" });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], deck: deck as unknown as Deck };
}

export function validateDeckJson(jsonText: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (e) {
    return { valid: false, errors: [{ path: "$", message: `invalid JSON: ${(e as Error).message}` }] };
  }
  return validateDeck(raw);
}
