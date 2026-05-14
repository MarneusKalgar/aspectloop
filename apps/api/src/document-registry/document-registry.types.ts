export interface DocumentFieldConfig {
  codeListKey?: string;
  id: string;
  inputType: 'code-list' | 'date' | 'number' | 'text';
  label: string;
  path: string;
  required?: boolean;
  validation?: DocumentFieldValidationConfig;
}

export interface DocumentFieldValidationConfig {
  max?: number;
  maxLength?: number;
  min?: number;
  minLength?: number;
  pattern?: string;
  scale?: number;
}

export interface DocumentSectionConfig {
  fields: DocumentFieldConfig[];
  id: string;
  label: string;
  path: string;
  repeatable: boolean;
}

export interface DocumentTypeConfig {
  label: string;
  sections: DocumentSectionConfig[];
  type: string;
  version: number;
}

export interface DocumentTypeSummary {
  label: string;
  type: string;
  version: number;
}
