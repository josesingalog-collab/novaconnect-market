import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

export interface FieldError {
  message: string;
}

export interface FieldBaseProps {
  label: string;
  error?: FieldError;
  hint?: string;
  required?: boolean;
  className?: string;
}

export interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement>, FieldBaseProps {
  type?: string;
}

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldBaseProps {
  maxLength?: number;
}

export interface SelectFieldProps extends InputHTMLAttributes<HTMLSelectElement>, FieldBaseProps {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

const fieldLabelId = (id: string) => `${id}-label`;
const fieldErrorId = (id: string) => `${id}-error`;
const fieldHintId = (id: string) => `${id}-hint`;

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, hint, required, className, id, ...props }, ref) => {
    const uid = id ?? label.toLowerCase().replace(/\s+/g, "-");
    const describedBy = [
      error ? fieldErrorId(uid) : null,
      hint ? fieldHintId(uid) : null,
    ].filter(Boolean).join(" ") || undefined;

    return (
      <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
        <label id={fieldLabelId(uid)} htmlFor={uid} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
        </label>
        <input
          ref={ref}
          id={uid}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
          {...props}
        />
        {hint && !error && (
          <p id={fieldHintId(uid)} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={fieldErrorId(uid)} role="alert" className="text-xs text-destructive">
            {error.message}
          </p>
        )}
      </div>
    );
  }
);

InputField.displayName = "InputField";

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, hint, required, maxLength, className, id, ...props }, ref) => {
    const uid = id ?? label.toLowerCase().replace(/\s+/g, "-");
    const describedBy = [
      error ? fieldErrorId(uid) : null,
      hint ? fieldHintId(uid) : null,
    ].filter(Boolean).join(" ") || undefined;

    return (
      <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
        <div className="flex items-center justify-between">
          <label id={fieldLabelId(uid)} htmlFor={uid} className="text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
          </label>
          {maxLength && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {(props.value as string | undefined)?.length ?? 0}/{maxLength}
            </span>
          )}
        </div>
        <textarea
          ref={ref}
          id={uid}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 resize-y min-h-[80px]"
          {...props}
        />
        {hint && !error && (
          <p id={fieldHintId(uid)} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={fieldErrorId(uid)} role="alert" className="text-xs text-destructive">
            {error.message}
          </p>
        )}
      </div>
    );
  }
);

TextareaField.displayName = "TextareaField";

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, hint, required, options, placeholder, className, id, ...props }, ref) => {
    const uid = id ?? label.toLowerCase().replace(/\s+/g, "-");
    const describedBy = [
      error ? fieldErrorId(uid) : null,
      hint ? fieldHintId(uid) : null,
    ].filter(Boolean).join(" ") || undefined;

    return (
      <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
        <label id={fieldLabelId(uid)} htmlFor={uid} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
        </label>
        <select
          ref={ref}
          id={uid}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
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
        {hint && !error && (
          <p id={fieldHintId(uid)} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={fieldErrorId(uid)} role="alert" className="text-xs text-destructive">
            {error.message}
          </p>
        )}
      </div>
    );
  }
);

SelectField.displayName = "SelectField";