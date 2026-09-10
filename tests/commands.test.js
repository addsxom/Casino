const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const COMMANDS_DIR =
  path.resolve(
    __dirname,
    '..',
    'Commands'
  );

function getCommandFiles() {
  const result = [];

  for (
    const category
    of fs.readdirSync(COMMANDS_DIR)
  ) {
    const categoryPath =
      path.join(
        COMMANDS_DIR,
        category
      );

    if (
      !fs.statSync(
        categoryPath
      ).isDirectory()
    ) {
      continue;
    }

    for (
      const file
      of fs.readdirSync(
        categoryPath
      )
    ) {
      if (
        file.endsWith('.js')
      ) {
        result.push(
          path.join(
            categoryPath,
            file
          )
        );
      }
    }
  }

  return result;
}

test(
  'all command modules expose valid unique names and aliases',
  () => {
    const names = new Map();
    const aliases = new Map();

    for (
      const file
      of getCommandFiles()
    ) {
      const command =
        require(file);

      assert.equal(
        typeof command?.name,
        'string',
        `${file} doit exporter command.name`
      );

      assert.ok(
        command.name.trim(),
        `${file} a un command.name vide`
      );

      assert.equal(
        typeof command.execute,
        'function',
        `${command.name} doit exporter execute()`
      );

      assert.equal(
        names.has(command.name),
        false,
        `Commande dupliquée : ${command.name}`
      );

      names.set(
        command.name,
        file
      );

      for (
        const alias
        of command.aliases || []
      ) {
        assert.equal(
          typeof alias,
          'string'
        );

        assert.ok(
          alias.trim()
        );

        assert.equal(
          alias === command.name,
          false,
          `Alias identique au nom : ${alias}`
        );

        assert.equal(
          aliases.has(alias),
          false,
          `Alias dupliqué : ${alias}`
        );

        aliases.set(
          alias,
          command.name
        );
      }
    }

    for (
      const [alias, commandName]
      of aliases
    ) {
      assert.equal(
        names.has(alias),
        false,
        `L'alias ${alias} de ${commandName} masque une commande existante`
      );
    }
  }
);
