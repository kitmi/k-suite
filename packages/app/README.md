# @k-suite/app

Micro service app library

## example

### usage

    const CliApp = require('@k-suite/app');

    let cliApp = new CliApp('test');

    cliApp.start_().then(() => {
        cliApp.log('info', 'started.');

        cliApp.showUsage();

        let biLogs = cliApp.getService('logger:bi');
        biLogs.info({
            user: 'tester',
            operation: 'ad hoc smoke test'
        });

        let tracer = cliApp.getService('logger:trace');
        tracer.info(cliApp.settings.parser.lib);

        return cliApp.stop_();
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });

### sample app config

    {
        "version": "1.0",
        "cmdLineOptions": {
            "banner": "#!jsv: (app) => `This is the program banner v${app.version}`",
            "arguments": [
                { "name": "target file", "required": true }
            ],  
            "options": {
                "e": {
                    "desc": "Target environment",
                    "alias": [ "env", "environment" ],
                    "default": "development"
                },            
                "v": {
                    "desc": "Show version number",
                    "alias": [ "version" ],
                    "isBool": true,
                    "default": false
                },
                "?": {
                    "desc": "Show usage message",
                    "alias": [ "help" ],
                    "isBool": true,
                    "default": false
                }
            }
        },  
        "bootstrap": {},
        "devConfigByGitUser": {},
        "settings": {
            "parser": {
                "lib": "default"
            }
        },
        "loggers": {
            "trace": {
                "transports": [
                {
                    "type": "console",                   
                    "options": {      
                        "level": "info",                      
                        "format": "#!jsv: log.format.combine(log.format.colorize(), log.format.simple())"
                    }
                },
                {
                    "type": "daily-rotate-file",                   
                    "options": {
                        "level": "verbose",
                        "filename": "category2-%DATE%.log",
                        "datePattern": "YYYYMMDD"
                    }
                }
            ]
            },
            "bi": {
                "transports": [
                    {
                    "type": "mongodb",
                    "options": {
                        "db": "mongodb://root:root@localhost/biLogs?authSource=admin"
                    }
                }
                ]
            }
        }
    }

## License

  MIT    