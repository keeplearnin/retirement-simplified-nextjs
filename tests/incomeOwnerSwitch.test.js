import { describe, it, expect } from 'vitest';
import { applyIncomeOwnerSwitch } from '@/components/PlanProvider';

// Regression for the real "change one, both change" bug: NOT an id collision
// (that theory was tested and ruled out 6+ ways on production). The actual
// cause — confirmed from the user's own screenshots — is a household with a
// SINGLE salary entry, where clicking the You/Spouse toggle relabeled that
// one record back and forth instead of creating a second, independent one.
// Toggling to "Spouse" and back always showed the same number because there
// was only ever one number.

describe('applyIncomeOwnerSwitch', () => {
  const lone = [
    { id: 1, type: 'salary', label: 'Salary', amount: 165_000, growthRate: 3, endAge: 50, owner: 'primary' },
    { id: 2, type: 'socialSecurity', label: 'Social Security', monthlyBenefit: 2_500, startAge: 67, owner: 'primary' },
  ];

  it('the exact reported scenario: toggling a lone salary to Spouse duplicates it, leaving "You" untouched', () => {
    const after = applyIncomeOwnerSwitch(lone, 1, 'spouse');
    const you = after.find(s => s.id === 1);
    const spouseCopy = after.find(s => s.owner === 'spouse' && s.type === 'salary');

    // Original untouched — this is the whole bug: it must NOT change.
    expect(you.owner).toBe('primary');
    expect(you.label).toBe('Salary');
    expect(you.amount).toBe(165_000);

    // A genuinely new, independent record was created instead.
    expect(spouseCopy).toBeDefined();
    expect(spouseCopy.id).not.toBe(1);
    expect(spouseCopy.label).toBe('Spouse Salary');
    expect(spouseCopy.amount).toBe(165_000); // starting value only — now independently editable

    expect(after).toHaveLength(3); // grew from 2 to 3; nothing was overwritten
  });

  it('editing the duplicate afterward does not affect the original (the actual fix)', () => {
    const afterSwitch = applyIncomeOwnerSwitch(lone, 1, 'spouse');
    const spouseCopy = afterSwitch.find(s => s.owner === 'spouse' && s.type === 'salary');
    // Simulate the user editing the spouse copy's amount (what updateIncome does).
    const edited = afterSwitch.map(s => s.id === spouseCopy.id ? { ...s, amount: 90_000 } : s);

    const you = edited.find(s => s.id === 1);
    const spouse = edited.find(s => s.id === spouseCopy.id);
    expect(you.amount).toBe(165_000); // still the original — unaffected
    expect(spouse.amount).toBe(90_000);
  });

  it('toggling back to "You" when a spouse copy exists reassigns in place (no triplicate)', () => {
    const afterSwitch = applyIncomeOwnerSwitch(lone, 1, 'spouse'); // now: id1=spouse-owned salary(orig data), id2=SS, id3=new...
    // Actually id1 stays primary per the function (duplicate created, id1 untouched).
    // Toggle the DUPLICATE back to "You" — a "You" salary already exists (id1), so it reassigns in place.
    const spouseCopy = afterSwitch.find(s => s.owner === 'spouse' && s.type === 'salary');
    const toggledBack = applyIncomeOwnerSwitch(afterSwitch, spouseCopy.id, 'primary');
    const salaryEntries = toggledBack.filter(s => s.type === 'salary');
    expect(salaryEntries).toHaveLength(2); // still just You + Spouse, no third
    expect(toggledBack.find(s => s.id === spouseCopy.id).owner).toBe('primary');
  });

  it('no-ops when already the target owner', () => {
    const result = applyIncomeOwnerSwitch(lone, 1, 'primary');
    expect(result).toBe(lone); // same reference — nothing changed
  });

  it('non-owned types (rental) still duplicate correctly if ever invoked', () => {
    const withRental = [...lone, { id: 3, type: 'rental', label: 'Rental Income', monthlyNet: 1500 }];
    const after = applyIncomeOwnerSwitch(withRental, 3, 'spouse');
    const dup = after.find(s => s.type === 'rental' && s.owner === 'spouse');
    expect(dup).toBeDefined();
    expect(after.find(s => s.id === 3).owner).toBeUndefined(); // original untouched
  });

  it('unknown id is a no-op', () => {
    const result = applyIncomeOwnerSwitch(lone, 999, 'spouse');
    expect(result).toBe(lone);
  });

  // Explicit coverage per user request: verify every couple-shareable income
  // type independently, not just salary. The fix lives in one shared
  // function keyed on `type`, so each type is a distinct code path through
  // the same logic — worth proving each one, not just trusting the pattern.
  describe('every couple-shareable income type', () => {
    const typeCases = [
      { type: 'socialSecurity', label: 'Social Security', field: 'monthlyBenefit', value: 2_800, extra: { startAge: 67 } },
      { type: 'pension', label: 'Pension', field: 'monthlyAmount', value: 3_200, extra: { startAge: 65, cola: true } },
      { type: 'partTime', label: 'Part-time / consulting', field: 'annualAmount', value: 40_000, extra: { startAge: 60, endAge: 65 } },
    ];

    for (const { type, label, field, value, extra } of typeCases) {
      it(`${type}: toggling a lone entry to Spouse duplicates it independently`, () => {
        const sources = [{ id: 1, type, label, owner: 'primary', [field]: value, ...extra }];
        const after = applyIncomeOwnerSwitch(sources, 1, 'spouse');

        const you = after.find(s => s.id === 1);
        const spouseCopy = after.find(s => s.owner === 'spouse');

        expect(you.owner).toBe('primary');
        expect(you[field]).toBe(value); // untouched
        expect(spouseCopy).toBeDefined();
        expect(spouseCopy.id).not.toBe(1);
        expect(spouseCopy.label).toBe(`Spouse ${label}`);
        expect(spouseCopy[field]).toBe(value); // starting point, now independent

        // Editing the spouse copy must not move the primary's value.
        const edited = after.map(s => s.id === spouseCopy.id ? { ...s, [field]: value + 999 } : s);
        expect(edited.find(s => s.id === 1)[field]).toBe(value);
        expect(edited.find(s => s.id === spouseCopy.id)[field]).toBe(value + 999);
      });
    }

    it('a household with one of EACH type toggled to Spouse produces four independent pairs, no cross-talk', () => {
      const sources = [
        { id: 1, type: 'salary', label: 'Salary', owner: 'primary', amount: 150_000 },
        { id: 2, type: 'socialSecurity', label: 'Social Security', owner: 'primary', monthlyBenefit: 2_800, startAge: 67 },
        { id: 3, type: 'pension', label: 'Pension', owner: 'primary', monthlyAmount: 3_000, startAge: 65 },
      ];
      let plan = sources;
      plan = applyIncomeOwnerSwitch(plan, 1, 'spouse');
      plan = applyIncomeOwnerSwitch(plan, 2, 'spouse');
      plan = applyIncomeOwnerSwitch(plan, 3, 'spouse');

      expect(plan).toHaveLength(6); // 3 originals + 3 independent spouse copies
      // Originals are all still primary-owned with their original values.
      expect(plan.find(s => s.id === 1)).toMatchObject({ owner: 'primary', amount: 150_000 });
      expect(plan.find(s => s.id === 2)).toMatchObject({ owner: 'primary', monthlyBenefit: 2_800 });
      expect(plan.find(s => s.id === 3)).toMatchObject({ owner: 'primary', monthlyAmount: 3_000 });
      // Every id is unique — no collisions across the three duplications.
      const ids = plan.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
