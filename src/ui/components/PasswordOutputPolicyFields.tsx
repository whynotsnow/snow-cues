import type { PasswordOutputPolicy } from "../../crypto-engine/output-policy";
import { CheckboxField, NumberField, TextField } from "../design-system";

type PasswordOutputPolicyFieldsProps = {
  disabled?: boolean;
  policy: PasswordOutputPolicy;
  onChange: (policy: PasswordOutputPolicy) => void;
};

export function PasswordOutputPolicyFields({ disabled = false, policy, onChange }: PasswordOutputPolicyFieldsProps) {
  function patch(next: Partial<PasswordOutputPolicy>) {
    onChange({
      ...policy,
      ...next
    });
  }

  return (
    <div className="policy-fields">
      <NumberField
        disabled={disabled}
        label="长度"
        max={128}
        min={4}
        onChange={(event) => patch({ length: Number(event.target.value) })}
        value={policy.length}
      />
      <NumberField
        disabled={disabled || !policy.useUppercase}
        label="最少大写"
        min={0}
        onChange={(event) => patch({ minUppercase: Number(event.target.value) })}
        value={policy.minUppercase}
      />
      <NumberField
        disabled={disabled || !policy.useLowercase}
        label="最少小写"
        min={0}
        onChange={(event) => patch({ minLowercase: Number(event.target.value) })}
        value={policy.minLowercase}
      />
      <NumberField
        disabled={disabled || !policy.useDigits}
        label="最少数字"
        min={0}
        onChange={(event) => patch({ minDigits: Number(event.target.value) })}
        value={policy.minDigits}
      />
      <NumberField
        disabled={disabled || !policy.useSymbols}
        label="最少符号"
        min={0}
        onChange={(event) => patch({ minSymbols: Number(event.target.value) })}
        value={policy.minSymbols}
      />
      <div className="checkbox-row">
        <CheckboxField
          checked={policy.useUppercase}
          disabled={disabled}
          label="大写"
          onChange={(event) => patch({ useUppercase: event.target.checked, minUppercase: event.target.checked ? policy.minUppercase : 0 })}
        />
        <CheckboxField
          checked={policy.useLowercase}
          disabled={disabled}
          label="小写"
          onChange={(event) => patch({ useLowercase: event.target.checked, minLowercase: event.target.checked ? policy.minLowercase : 0 })}
        />
        <CheckboxField
          checked={policy.useDigits}
          disabled={disabled}
          label="数字"
          onChange={(event) => patch({ useDigits: event.target.checked, minDigits: event.target.checked ? policy.minDigits : 0 })}
        />
        <CheckboxField
          checked={policy.useSymbols}
          disabled={disabled}
          label="符号"
          onChange={(event) => patch({ useSymbols: event.target.checked, minSymbols: event.target.checked ? policy.minSymbols : 0 })}
        />
      </div>
      <TextField
        autoComplete="off"
        disabled={disabled || !policy.useSymbols}
        label="允许符号"
        onChange={(event) => patch({ allowedSymbols: event.target.value })}
        value={policy.allowedSymbols}
      />
      <TextField
        autoComplete="off"
        disabled={disabled}
        label="排除字符"
        onChange={(event) => patch({ forbiddenChars: event.target.value })}
        placeholder="例如 O0Il1"
        value={policy.forbiddenChars}
      />
    </div>
  );
}
