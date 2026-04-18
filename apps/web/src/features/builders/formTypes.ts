export type FormTabSort = 'alphabetical' | 'manual';

export type FormFieldChoice = {
  id: string;
  label: string;
  value: string;
  active: boolean;
};

export type FormFieldValidation = {
  id: string;
  operator:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'HAS_VALUE'
    | 'NO_VALUE'
    | 'GREATER_THAN'
    | 'LESS_THAN'
    | 'BEFORE'
    | 'AFTER'
    | 'WITHIN_LAST'
    | 'WITHIN_NEXT';
  valueSource: 'constant' | 'field';
  value: string;
  errorMessage?: string | null;
};

export type FormField = {
  id: string;
  displayName: string;
  systemName: string;
  fieldType:
    | 'Text Field'
    | 'Text Area'
    | 'Rich Text'
    | 'Email'
    | 'Phone'
    | 'URL'
    | 'IP Address'
    | 'MAC Address'
    | 'Number'
    | 'Whole Number'
    | 'Dollar'
    | 'Range'
    | 'Date'
    | 'Date Time Hour'
    | 'Select'
    | 'Users'
    | 'Organizations'
    | 'Facilities'
    | 'Risk Probability'
    | 'Risk Consequence'
    | 'Compliance Settings'
    | 'Checkbox'
    | 'Toggle'
    | 'Label'
    | 'HTML'
    | 'Section Header'
    | 'Button';
  required: boolean;
  active: boolean;
  editable: boolean;
  helpText?: string | null;
  pattern?: string | null;
  min?: number | null;
  max?: number | null;
  selectType?: string | null;
  sectionId: string;
  choices: FormFieldChoice[];
  validations: FormFieldValidation[];
  lockedType?: boolean;
};

export type FormSection = {
  id: string;
  displayName: string;
  active: boolean;
  isDefault: boolean;
  isSystem: boolean;
  fields: FormField[];
};

export type FormRuleCondition = {
  id: string;
  conditionType: 'Field' | 'System - NO_PARENT' | 'System - NO_CONDITION' | 'Tenant Feature' | 'Module';
  target: string;
  operator:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'HAS_VALUE'
    | 'NO_VALUE'
    | 'GREATER_THAN'
    | 'LESS_THAN'
    | 'BEFORE'
    | 'AFTER'
    | 'WITHIN_LAST'
    | 'WITHIN_NEXT'
    | 'ENABLED'
    | 'DISABLED';
  valueSource: 'constant' | 'field' | 'system';
  value: string;
};

export type FormRuleAction = {
  id: string;
  actionType: 'SHOW' | 'HIDE' | 'REQUIRE' | 'NOT_REQUIRE' | 'ENABLE' | 'DISABLE' | 'SET_VALUE' | 'VALIDATE';
  targetType: 'Field' | 'Tab';
  target: string;
  operator?: string | null;
  value?: string | null;
  bypassExistingValue?: boolean;
  allowExternalValue?: boolean;
};

export type FormRule = {
  id: string;
  name: string;
  logic: 'AND' | 'OR';
  conditions: FormRuleCondition[];
  actions: FormRuleAction[];
};

export type FormBuilderDiagnostic = {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
};

export type FormBuilderSummary = {
  id: string;
  moduleKey: string;
  moduleName: string;
  pluralName: string;
  tabSort: FormTabSort;
  status: string;
  sectionCount: number;
  fieldCount: number;
  ruleCount: number;
  updatedAt: string;
};

export type FormBuilderDetail = {
  id: string;
  moduleKey: string;
  moduleName: string;
  pluralName: string;
  tabSort: FormTabSort;
  status: string;
  description: string | null;
  sections: FormSection[];
  rules: FormRule[];
  diagnostics: FormBuilderDiagnostic[];
  createdAt: string;
  updatedAt: string;
};
