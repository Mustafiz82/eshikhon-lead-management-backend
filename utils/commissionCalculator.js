
export const calculateCommissionBreakdown = (totalSales) => {
  const sales = Number(totalSales) || 0;

  // 1. Calculate Target Amount (Milestone logic)
  let targetAmount = 50000;
  if (sales >= 2000000) {
    targetAmount = 2000000; // Locked at last milestone
  } else if (sales >= 50000) {
    targetAmount = Math.ceil((sales + 1) / 100000) * 100000;
  }

  // 2. Calculate Target Completion Rate (Rounded to nearest integer)
  const targetCompletionRate = targetAmount > 0 ? Math.round((sales / targetAmount) * 100) : 0;

  // 3. Sales below 50,000 result in 0 commission
  if (sales < 50000) {
    return {
      rate: 0,
      baseCommission: 0,
      extraBonus: 0,
      totalCommission: 0,
      targetAmount,
      targetCompletionRate
    };
  }

  // 4. Rate starts at 1000, and increases by 100 for every 100k of sales
  const increments = Math.floor(sales / 100000);
  const rate = 1000 + (increments * 100);

  // 5. Base Commission = sales * (rate / 100,000)
  const baseCommission = Math.round(sales * (rate / 100000));

  // 6. Determine the milestone extra bonus
  let extraBonus = 0;
  if (sales >= 2000000) {
    extraBonus = 40000;
  } else if (sales >= 1500000) {
    extraBonus = 25000;
  } else if (sales >= 1000000) {
    extraBonus = 15000;
  } else if (sales >= 700000) {
    extraBonus = 10000;
  } else if (sales >= 500000) {
    extraBonus = 6000;
  } else if (sales >= 400000) {
    extraBonus = 4000;
  } else if (sales >= 300000) {
    extraBonus = 3000;
  } else if (sales >= 200000) {
    extraBonus = 1500;
  } else if (sales >= 100000) {
    extraBonus = 500;
  }

  const totalCommission = baseCommission + extraBonus;

  return {
    rate,
    baseCommission,
    extraBonus,
    totalCommission,
    targetAmount,
    targetCompletionRate
  };
};