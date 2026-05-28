import type { FormBuilderDetail, FormField, FormRuleAction, FormRuleCondition } from './formTypes';

type FieldState = {
  visible: boolean;
  required: boolean;
  editable: boolean;
  validations: FormRuleAction[];
  errors: string[];
};

type SectionState = {
  visible: boolean;
};

export type FormRuntimeResult = {
  data: Record<string, unknown>;
  fields: Record<string, FieldState>;
  sections: Record<string, SectionState>;
  errors: Array<{ field: string; message: string }>;
};

type RuntimeContext = {
  isNewRecord: boolean;
  enabledFeatures?: string[];
  enabledModules?: string[];
  now?: Date;
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function hasValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function asComparableValue(value: unknown) {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function daysFromNow(now: Date, days: number) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function specialValue(value: string, now: Date) {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'TODAY') {
    return dateOnly(now);
  }
  if (normalized === 'TOMORROW') {
    return dateOnly(daysFromNow(now, 1));
  }
  if (normalized === 'YESTERDAY') {
    return dateOnly(daysFromNow(now, -1));
  }
  if (normalized === 'NOW') {
    return now.toISOString();
  }
  return value;
}

function resolveConfiguredValue(
  configuredValue: string | null | undefined,
  data: Record<string, unknown>,
  now: Date,
) {
  const value = configuredValue ?? '';
  if (value.trim().startsWith('@')) {
    return data[value.trim().slice(1)] ?? '';
  }
  return specialValue(value, now);
}

function compareValues(operator: string | null | undefined, actual: unknown, expected: unknown, now: Date) {
  const normalizedOperator = (operator || 'EQUALS').toUpperCase();
  if (normalizedOperator === 'HAS_VALUE') {
    return hasValue(actual);
  }
  if (normalizedOperator === 'NO_VALUE') {
    return !hasValue(actual);
  }

  const actualText = asComparableValue(actual);
  const expectedText = asComparableValue(expected);

  if (normalizedOperator === 'EQUALS') {
    return actualText === expectedText;
  }
  if (normalizedOperator === 'NOT_EQUALS') {
    return actualText !== expectedText;
  }

  const actualNumber = Number(actualText);
  const expectedNumber = Number(expectedText);
  if (normalizedOperator === 'GREATER_THAN') {
    return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) && actualNumber > expectedNumber;
  }
  if (normalizedOperator === 'LESS_THAN') {
    return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) && actualNumber < expectedNumber;
  }

  const actualDate = new Date(actualText);
  const expectedDate = new Date(expectedText);
  if (normalizedOperator === 'BEFORE') {
    return !Number.isNaN(actualDate.getTime()) && !Number.isNaN(expectedDate.getTime()) && actualDate < expectedDate;
  }
  if (normalizedOperator === 'AFTER') {
    return !Number.isNaN(actualDate.getTime()) && !Number.isNaN(expectedDate.getTime()) && actualDate > expectedDate;
  }
  if (normalizedOperator === 'WITHIN_LAST') {
    const days = Number(expectedText);
    return !Number.isNaN(actualDate.getTime()) && Number.isFinite(days) && actualDate >= daysFromNow(now, -days) && actualDate <= now;
  }
  if (normalizedOperator === 'WITHIN_NEXT') {
    const days = Number(expectedText);
    return !Number.isNaN(actualDate.getTime()) && Number.isFinite(days) && actualDate >= now && actualDate <= daysFromNow(now, days);
  }

  return true;
}

function conditionMatches(
  condition: FormRuleCondition,
  data: Record<string, unknown>,
  context: Required<RuntimeContext>,
) {
  if (condition.conditionType === 'System - NO_CONDITION') {
    return true;
  }
  if (condition.conditionType === 'System - NO_PARENT') {
    return context.isNewRecord;
  }
  if (condition.conditionType === 'Tenant Feature') {
    const hasFeature = context.enabledFeatures.map(normalizeKey).includes(normalizeKey(condition.target));
    return condition.operator === 'DISABLED' ? !hasFeature : hasFeature;
  }
  if (condition.conditionType === 'Module') {
    const hasModule = context.enabledModules.map(normalizeKey).includes(normalizeKey(condition.target));
    return condition.operator === 'DISABLED' ? !hasModule : hasModule;
  }

  const expected = condition.valueSource === 'field'
    ? data[condition.value]
    : resolveConfiguredValue(condition.value, data, context.now);
  return compareValues(condition.operator, data[condition.target], expected, context.now);
}

function buildFieldIndex(schema: FormBuilderDetail) {
  const fields = new Map<string, FormField>();
  for (const section of schema.sections) {
    for (const field of section.fields) {
      fields.set(field.systemName, field);
    }
  }
  return fields;
}

function coerceValueForField(field: FormField | undefined, value: unknown) {
  if (!field) {
    return value;
  }
  if (field.fieldType === 'Checkbox' || field.fieldType === 'Toggle') {
    if (typeof value === 'boolean') {
      return value;
    }
    return String(value).toLowerCase() === 'true';
  }
  if (['Number', 'Whole Number', 'Dollar', 'Currency Label', 'Range', 'Risk Probability', 'Risk Consequence'].includes(field.fieldType)) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  return value;
}

function validateFieldValue(field: FormField, value: unknown, data: Record<string, unknown>, now: Date) {
  const errors: string[] = [];
  if (field.pattern && hasValue(value)) {
    try {
      if (!new RegExp(field.pattern).test(String(value))) {
        errors.push(`${field.displayName} does not match the required pattern.`);
      }
    } catch {
      errors.push(`${field.displayName} has an invalid validation pattern.`);
    }
  }

  const numeric = Number(value);
  if (hasValue(value) && Number.isFinite(numeric)) {
    if (field.min !== null && field.min !== undefined && numeric < field.min) {
      errors.push(`${field.displayName} must be greater than or equal to ${field.min}.`);
    }
    if (field.max !== null && field.max !== undefined && numeric > field.max) {
      errors.push(`${field.displayName} must be less than or equal to ${field.max}.`);
    }
  }

  for (const validation of field.validations) {
    const expected = validation.valueSource === 'field'
      ? data[validation.value]
      : resolveConfiguredValue(validation.value, data, now);
    if (!compareValues(validation.operator, value, expected, now)) {
      errors.push(validation.errorMessage?.trim() || `${field.displayName} failed ${validation.operator} validation.`);
    }
  }
  return errors;
}

export function evaluateFormRuntime(
  schema: FormBuilderDetail | null,
  data: Record<string, unknown>,
  context: RuntimeContext,
): FormRuntimeResult {
  const now = context.now ?? new Date();
  const runtimeContext: Required<RuntimeContext> = {
    isNewRecord: context.isNewRecord,
    enabledFeatures: context.enabledFeatures ?? [],
    enabledModules: context.enabledModules ?? [],
    now,
  };
  if (!schema) {
    return { data, fields: {}, sections: {}, errors: [] };
  }

  const nextData = { ...data };
  const fields = buildFieldIndex(schema);
  const fieldStates: Record<string, FieldState> = {};
  const sectionStates: Record<string, SectionState> = {};

  for (const section of schema.sections) {
    sectionStates[section.id] = { visible: section.active };
    sectionStates[section.displayName] = sectionStates[section.id];
    for (const field of section.fields) {
      fieldStates[field.systemName] = {
        visible: section.active && field.active,
        required: field.required,
        editable: field.editable,
        validations: [],
        errors: [],
      };
    }
  }

  for (const rule of schema.rules) {
    if (rule.active === false) {
      continue;
    }
    const conditionResults = rule.conditions.map((condition) => conditionMatches(condition, nextData, runtimeContext));
    const matches = rule.logic === 'OR' ? conditionResults.some(Boolean) : conditionResults.every(Boolean);
    if (!matches) {
      continue;
    }

    for (const action of rule.actions) {
      const target = action.target;
      if (!target) {
        continue;
      }
      if (action.targetType === 'Tab') {
        const section = sectionStates[target];
        if (!section) {
          continue;
        }
        if (action.actionType === 'SHOW') section.visible = true;
        if (action.actionType === 'HIDE') section.visible = false;
        continue;
      }

      const fieldState = fieldStates[target];
      if (!fieldState) {
        continue;
      }
      if (action.actionType === 'SHOW') fieldState.visible = true;
      if (action.actionType === 'HIDE') fieldState.visible = false;
      if (action.actionType === 'REQUIRE') fieldState.required = true;
      if (action.actionType === 'NOT_REQUIRE') fieldState.required = false;
      if (action.actionType === 'ENABLE') fieldState.editable = true;
      if (action.actionType === 'DISABLE') fieldState.editable = false;
      if (action.actionType === 'VALIDATE') fieldState.validations.push(action);
      if (action.actionType === 'SET_VALUE') {
        const currentValue = nextData[target];
        if (action.bypassExistingValue || !hasValue(currentValue)) {
          nextData[target] = coerceValueForField(fields.get(target), resolveConfiguredValue(action.value, nextData, now));
        }
      }
    }
  }

  const errors: Array<{ field: string; message: string }> = [];
  for (const section of schema.sections) {
    const sectionVisible = sectionStates[section.id]?.visible ?? section.active;
    for (const field of section.fields) {
      const state = fieldStates[field.systemName];
      if (!sectionVisible || !state?.visible) {
        if (state) state.required = false;
        continue;
      }
      const value = nextData[field.systemName];
      if (state.required && !hasValue(value)) {
        state.errors.push(`${field.displayName} is required.`);
      }
      state.errors.push(...validateFieldValue(field, value, nextData, now));
      for (const validation of state.validations) {
        const expected = resolveConfiguredValue(validation.value, nextData, now);
        if (!compareValues(validation.operator, value, expected, now)) {
          state.errors.push(`${field.displayName} failed ${validation.operator || 'conditional'} validation.`);
        }
      }
      for (const message of state.errors) {
        errors.push({ field: field.systemName, message });
      }
    }
  }

  return {
    data: nextData,
    fields: fieldStates,
    sections: sectionStates,
    errors,
  };
}
