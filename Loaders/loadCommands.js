const colors = require('colors');
const fs = require('fs');
const AsciiTable = require('ascii-table');
const table = new AsciiTable();
table.setHeading('Commands', 'Stats').setBorder('|', '=', '0', '0');

module.exports = bot => {
  fs.readdirSync('./Commands/').forEach(dir => {
    const files = fs.readdirSync(`./Commands/${dir}/`).filter(file => file.endsWith('.js'));
    
    if (!files || files.length <= 0) {
      console.log(colors.red(`No commands in directory ${dir}.`));
    }

    files.forEach(file => {
      try {
        let command = require(`../Commands/${dir}/${file}`);
        
        if (command && command.name) {
          command.category = command.category || dir;
          command.file = file;

          bot.commands.set(command.name, command);
          
          if (command.aliases && Array.isArray(command.aliases)) {
            command.aliases.forEach(alias => {
              bot.aliases.set(alias, command.name);
            });
          }
          
          table.addRow(command.name, '✅');
        } else {
          console.error(colors.red(`Error loading command from file ${file}: Command or command.name is missing.`));
          table.addRow(file, '⛔');
        }
      } catch (error) {
        console.error(colors.red(`Error loading command from file ${file}: ${error.message}`));
        table.addRow(file, '⛔');
      }
    });
  });

  console.log(colors.blue(table.toString()));
};
