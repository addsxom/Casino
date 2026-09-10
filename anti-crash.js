module.exports = () => {
    let shuttingDown = false;

    const fatal = (label, error) => {
        if (shuttingDown) return;
        shuttingDown = true;

        console.error(
            `----- ${label} -----`
        );
        console.error(error);

        // Quitte proprement : start.bat relance le process.
        setTimeout(() => {
            process.exit(1);
        }, 250);
    };

    process.on(
        'uncaughtException',
        error => {
            fatal(
                'Uncaught exception',
                error
            );
        }
    );

    process.on(
        'unhandledRejection',
        reason => {
            fatal(
                'Unhandled rejection',
                reason
            );
        }
    );

    process.on(
        'warning',
        warning => {
            console.warn(
                '----- Warning -----'
            );
            console.warn(
                warning?.name ||
                'Warning'
            );
            console.warn(
                warning?.message ||
                warning
            );

            if (warning?.stack) {
                console.warn(
                    warning.stack
                );
            }
        }
    );
};
