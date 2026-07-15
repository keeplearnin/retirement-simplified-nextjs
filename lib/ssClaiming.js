/**
 * ssClaiming.js — Social Security claiming-age math (pure, standalone).
 *
 * SSA rules: claiming before Full Retirement Age (67 for anyone born 1960+)
 * reduces the benefit 5/9% per month for the first 36 months early and
 * 5/12% per month beyond; delaying past FRA earns 2/3% per month (8%/yr)
 * in delayed credits through age 70.
 *
 * Extracted so standalone calculators and the AI agent share one source
 * of truth.
 */

export const SS_FRA = 67;

export function ssClaimingFactor(claimAge, fra = SS_FRA) {
  const monthsDiff = (claimAge - fra) * 12;
  if (monthsDiff === 0) return 1;
  if (monthsDiff < 0) {
    const monthsEarly = Math.abs(monthsDiff);
    const first36 = Math.min(monthsEarly, 36);
    const beyond36 = Math.max(monthsEarly - 36, 0);
    return 1 - (first36 * (5 / 900) + beyond36 * (5 / 1200));
  }
  return 1 + monthsDiff * (2 / 300);
}

/**
 * Compare claiming at each age 62–70 for a benefit stated at FRA.
 * Lifetime totals run to `longevityAge` with a COLA. Break-even is vs FRA:
 * the age at which the cumulative benefit of one choice overtakes the other.
 */
export function compareClaimingAges({ fraMonthlyBenefit, longevityAge, cola = 0.02 }) {
  const lifetime = (claimAge) => {
    const monthly = fraMonthlyBenefit * ssClaimingFactor(claimAge);
    const yearsCollecting = longevityAge - claimAge;
    if (yearsCollecting <= 0) return 0;
    // Annuity of monthly*12 growing at COLA for yearsCollecting years.
    return monthly * 12 * ((Math.pow(1 + cola, yearsCollecting) - 1) / cola);
  };

  const fraMonthly = fraMonthlyBenefit * ssClaimingFactor(SS_FRA);

  const options = [];
  for (let claimAge = 62; claimAge <= 70; claimAge++) {
    const factor = ssClaimingFactor(claimAge);
    const monthly = fraMonthlyBenefit * factor;

    // Break-even vs claiming at FRA (ignoring COLA for the crossover month —
    // the standard SSA-style approximation).
    let breakevenAge = null;
    if (claimAge < SS_FRA && fraMonthly > monthly) {
      const headstart = (SS_FRA - claimAge) * 12 * monthly;
      breakevenAge = Math.round((SS_FRA * 12 + headstart / (fraMonthly - monthly)) / 12);
    } else if (claimAge > SS_FRA && monthly > fraMonthly) {
      const foregone = (claimAge - SS_FRA) * 12 * fraMonthly;
      breakevenAge = Math.round((claimAge * 12 + foregone / (monthly - fraMonthly)) / 12);
    }

    options.push({
      claimAge,
      factor: Math.round(factor * 1000) / 1000,
      monthlyBenefit: Math.round(monthly),
      lifetimeToLongevity: Math.round(lifetime(claimAge)),
      breakevenAgeVsFRA: breakevenAge,
    });
  }

  const best = options.reduce((a, b) => (b.lifetimeToLongevity > a.lifetimeToLongevity ? b : a));
  return { options, best };
}
