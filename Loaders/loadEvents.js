const fs = require('fs');
const colors = require('colors');
var AsciiTable = require('ascii-table');
var table = new AsciiTable();
table.setHeading('Events', 'Stats').setBorder('|', '=', "0", "0");

module.exports = async bot => {
  fs.readdirSync("./Events").filter(f => f.endsWith(".js")).forEach(async file => {
      let event = require(`../Events/${file}`);
      table.addRow(file.slice(0, -3), '✅');
      bot.on(file.split(".js").join(""), event.bind(null, bot));
    });
  console.log(colors.green(table.toString()));
};