const db = require('./database/db');
const email = 'claudio.meneghetti@studiome.com.br';
db.run("UPDATE users SET role = 'dev' WHERE email = ?", [email], (err) => {
    if (err) console.error(err);
    else console.log('Successfully updated to dev');
    process.exit(0);
});
