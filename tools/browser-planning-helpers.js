// Follow the same menu interaction as a user; never force-click hidden options.
async function choosePlanningQuickShift(page, code) {
  const choice = page.locator('[data-quick="' + code + '"]');
  if (!await choice.isVisible()) await choice.locator('xpath=ancestor::details/summary').click();
  await choice.click();
}
module.exports = { choosePlanningQuickShift };
