// Only self-editable fields. Omitted fields must survive partial native saves.
export function profilePatch(body) {
  const patch = {};
  const limits = {firstName:80,lastName:80,displayName:120,pronouns:60,grade:30,bio:1000,phone:50,emergencyContact:250,theme:40};
  for (const [field, limit] of Object.entries(limits)) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== 'string' || body[field].trim().length > limit) throw new Error(`Invalid ${field}.`);
    patch[field] = body[field].trim();
    if (['firstName','lastName','displayName','theme'].includes(field) && !patch[field]) throw new Error(`${field} is required.`);
  }
  if (Object.hasOwn(body, 'visibility')) {
    if (!['Production','Departments','Staff'].includes(body.visibility)) throw new Error('Choose a valid profile visibility.');
    patch.visibility = body.visibility;
  }
  if (Object.hasOwn(body, 'themePreferences')) {
    const value = body.themePreferences;
    if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 8000) throw new Error('Invalid theme preferences.');
    patch.themePreferences = value;
  }
  return patch;
}
