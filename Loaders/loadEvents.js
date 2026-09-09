const fs = require('fs');
const colors = require('colors');
const AsciiTable = require('ascii-table');

module.exports = async bot => {
  const table = new AsciiTable();
  table.setHeading('Events', 'Stats').setBorder('|', '=', '0', '0');

  const files = fs
    .readdirSync('./Events')
    .filter(file => file.endsWith('.js'));

  for (const file of files) {
    try {
      const event = require(`../Events/${file}`);

      if (typeof event !== 'function') {
        throw new TypeError('Event module must export a function.');
      }

      const eventName = file.slice(0, -3);
      bot.on(eventName, event.bind(null, bot));
      table.addRow(eventName, '✅');
    } catch (error) {
      const eventName = file.slice(0, -3);

      console.error(
        colors.red(
          `Error loading event ${eventName}: ${error?.stack || error?.message || error}`
        )
      );

      table.addRow(eventName, '⛔');
    }
  }

  console.log(colors.green(table.toString()));
};
