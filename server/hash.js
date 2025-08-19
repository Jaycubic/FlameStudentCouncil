const bcrypt = require('bcrypt');

async function generateHash() {
  const password = '12345678';
  const saltRounds = 10; // Matches your system's bcrypt configuration
  const hash = await bcrypt.hash(password, saltRounds);
  console.log('New hash:', hash);
}

generateHash();