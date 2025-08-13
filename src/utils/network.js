const dns = require("dns");
const { promisify } = require("util");

dns.setDefaultResultOrder("ipv4first");
const lookup = promisify(dns.lookup);

async function testDNSResolution() {
  try {
    console.log("🔍 Testing DNS resolution for generativelanguage.googleapis.com...");
    const result = await lookup("generativelanguage.googleapis.com");
    console.log("✅ DNS resolution successful:", result);
    return true;
  } catch (error) {
    console.error("❌ DNS resolution failed:", error.message);
    return false;
  }
}

module.exports = { testDNSResolution };