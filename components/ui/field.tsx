import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

export interface FieldError {
  message: string;
}

export interface FieldBaseProps {
  label: string;
  error?: FieldError;
  hint?: string;
  description?: string;
  required?: boolean;
  className?: string;
}

export interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement>, FieldBaseProps {
  type?: string;
}

export interface TextareaFieldProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldBaseProps {
  maxLength?: number;
}

export interface SelectFieldProps extends InputHTMLAttributes<HTMLSelectElement>, FieldBaseProps {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

const fieldLabelId = (id: string) => `${id}-label`;
const fieldErrorId = (id: string) => `${id}-error`;
const fieldHintId = (id: string) => `${id}-hint`;
const fieldDescriptionId = (id: string) => `${id}-description`;

function buildDescribedBy(
  uid: string,
  hasError: boolean,
  hasHint: boolean,
  hasDescription: boolean,
): string | undefined {
  const parts = [
    hasError ? fieldErrorId(uid) : null,
    hasHint ? fieldHintId(uid) : null,
    hasDescription ? fieldDescriptionId(uid) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, hint, description, required, className, id, ...props }, ref) => {
    const uid = id ?? label.toLowerCase().replace(/\s+/g, "-");
    const hasError = !!error;
    const hasHint = !!hint;
    const hasDescription = !!description;
    const describedBy = buildDescribedBy(uid, hasError, hasHint, hasDescription);

    return (
      <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
        <label id={fieldLabelId(uid)} htmlFor={uid} className="text-sm font-medium text-foreground">
          {label}
          {required && (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {description && !hasError && (
          <p id={fieldDescriptionId(uid)} className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
        <input
          ref={ref}
          id={uid}
          aria-required={required}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          className="border-input rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
          {...props}
        />
        {hint && !hasError && (
          <p id={fieldHintId(uid)} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {hasError && (
          <p id={fieldErrorId(uid)} role="alert" className="text-xs text-destructive">
            {error.message}
          </p>
        )}
      </div>
    );
  },
);

InputField.displayName = "InputField";

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, hint, description, required, maxLength, className, id, ...props }, ref) => {
    const uid = id ?? label.toLowerCase().replace(/\s+/g, "-");
    const hasError = !!error;
    const hasHint = !!hint;
    const hasDescription = !!description;
    const describedBy = buildDescribedBy(uid, hasError, hasHint, hasDescription);

    return (
      <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
        <div className="flex items-center justify-between">
          <label
            id={fieldLabelId(uid)}
            htmlFor={uid}
            className="text-sm font-medium text-foreground"
          >
            {label}
            {required && (
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {maxLength && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {(props.value as string | undefined)?.length ?? 0}/{maxLength}
            </span>
          )}
        </div>
        {description && !hasError && (
          <p id={fieldDescriptionId(uid)} className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
        <textarea
          ref={ref}
          id={uid}
          aria-required={required}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          className="border-input min-h-[80px] resize-y rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
          {...props}
        />
        {hint && !hasError && (
          <p id={fieldHintId(uid)} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {hasError && (
          <p id={fieldErrorId(uid)} role="alert" className="text-xs text-destructive">
            {error.message}
          </p>
        )}
      </div>
    );
  },
);

TextareaField.displayName = "TextareaField";

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    { label, error, hint, description, required, options, placeholder, className, id, ...props },
    ref,
  ) => {
    const uid = id ?? label.toLowerCase().replace(/\s+/g, "-");
    const hasError = !!error;
    const hasHint = !!hint;
    const hasDescription = !!description;
    const describedBy = buildDescribedBy(uid, hasError, hasHint, hasDescription);

    return (
      <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
        <label id={fieldLabelId(uid)} htmlFor={uid} className="text-sm font-medium text-foreground">
          {label}
          {required && (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {description && !hasError && (
          <p id={fieldDescriptionId(uid)} className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
        <select
          ref={ref}
          id={uid}
          aria-required={required}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          className="border-input rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {hint && !hasError && (
          <p id={fieldHintId(uid)} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {hasError && (
          <p id={fieldErrorId(uid)} role="alert" className="text-xs text-destructive">
            {error.message}
          </p>
        )}
      </div>
    );
  },
);

SelectField.displayName = "SelectField";
