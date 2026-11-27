export type StudentGender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export function StudentGenderField({ value, onChange, initialValue = '', required = false }: {
  value?: StudentGender | '';
  initialValue?: StudentGender | '';
  onChange?: (value: StudentGender | '') => void;
  required?: boolean;
}) {
  return <label>Gender
    <select name="gender" value={value} defaultValue={value === undefined ? initialValue : undefined} required={required}
      onChange={onChange ? event => onChange(event.target.value as StudentGender | '') : undefined}>
      <option value="" disabled>Select gender</option>
      <option value="MALE">Male</option>
      <option value="FEMALE">Female</option>
      <option value="OTHER">Other</option>
      <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
    </select>
  </label>;
}
