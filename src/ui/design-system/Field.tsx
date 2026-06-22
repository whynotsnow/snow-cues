import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import { useId } from "react";

type FieldShellProps = {
  children: (id: string) => ReactNode;
  className?: string;
  hint?: ReactNode;
  label: ReactNode;
};

function FieldShell({ children, className = "", hint, label }: FieldShellProps) {
  const id = useId();
  const classNames = ["ds-field", className].filter(Boolean).join(" ");

  return (
    <div className={classNames}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint ? <span className="field-note">{hint}</span> : null}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  hint?: ReactNode;
  label: ReactNode;
};

export function TextField({ className = "", hint, label, type = "text", ...props }: TextFieldProps) {
  return (
    <FieldShell className={className} hint={hint} label={label}>
      {(id) => <input {...props} id={id} type={type} />}
    </FieldShell>
  );
}

export function NumberField({ className = "", hint, label, type = "number", ...props }: TextFieldProps) {
  return (
    <FieldShell className={className} hint={hint} label={label}>
      {(id) => <input {...props} id={id} type={type} />}
    </FieldShell>
  );
}

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  hint?: ReactNode;
  label: ReactNode;
};

export function TextareaField({ className = "", hint, label, ...props }: TextareaFieldProps) {
  return (
    <FieldShell className={className} hint={hint} label={label}>
      {(id) => <textarea {...props} id={id} />}
    </FieldShell>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  children: ReactNode;
  hint?: ReactNode;
  label: ReactNode;
};

export function SelectField({ children, className = "", hint, label, ...props }: SelectFieldProps) {
  return (
    <FieldShell className={className} hint={hint} label={label}>
      {(id) => (
        <select {...props} id={id}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  label: ReactNode;
};

export function CheckboxField({ className = "", label, ...props }: CheckboxFieldProps) {
  const id = useId();
  const classNames = ["checkbox-row", className].filter(Boolean).join(" ");

  return (
    <label className={classNames} htmlFor={id}>
      <input {...props} id={id} type="checkbox" />
      {label}
    </label>
  );
}
