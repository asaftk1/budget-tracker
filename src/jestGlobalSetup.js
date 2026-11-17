// Run all unit tests in an Israel timezone (UTC+2/+3) so date bugs that only
// appear east of UTC are reproducible regardless of the machine's timezone.
module.exports = async () => {
  process.env.TZ = 'Asia/Jerusalem';
};
