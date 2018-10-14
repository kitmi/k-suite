"use strict";

const path = require('path');
const Util = require('../../util.js');

const co = Util.co;
const fs = Util.fs;
const _ = Util._;
const glob = Util.glob;

const Schema = require('./schema.js');
const Entity = require('./entity.js');
const View = require('./view.js');
const Document = require('./document.js');
const Oolong = require('./oolong.js');
const OolUtil = require('./ool-utils.js');

const ELEMENT_CLASS_MAP = {
    entity: Entity,
    view: View,
    document: Document
};

const OolongParser = Oolong.parser;

class OolongLinker {
    /**
     * Linker of oolong DSL
     *
     * @constructs OolongLinker
     *
     * @param {object} context
     * @property {Logger} context.logger - Logger object
     * @property {AppModule} context.currentApp - Current app module
     */
    constructor(context) {
        /**
         * Logger
         * @type {Logger}
         * @public
         */
        this.logger = context.logger;

        /**
         * Current app module
         * @type {AppModule}
         * @public
         */
        this.currentAppModule = context.currentApp;

        /**
         * Linked schema
         * @type {object}
         * @public
         */
        this.schema = undefined;

        /**
         * Parsed oolong files, path => module
         * @type {object}
         * @private
         */
        this._oolModules = {};

        /**
         * Entities cache
         * @type {object}
         * @private
         */
        this._entityCache = {};

        /**
         * Types cache
         * @type {object}
         * @private
         */
        this._typeCache = {};

        /**
         * View cache
         * @type {object}
         * @private
         */
        this._viewCache = {};

        /**
         * Doc cache
         * @type {object}
         * @private
         */
        this._docCache = {};

        /**
         * Element cache
         * @type {object}
         * @private
         */
        this._elementsCache = {};


        this._namingTable = new Map();
    }

    /**
     * Write log
     * @param {string} level
     * @param {string} message
     * @param {object} [data]
     */
    log(level, message, data) {
        if (data) {
            this.logger.log(level, message, data);
        } else {
            this.logger.log(level, message);
        }
    }

    /**
     * Check whether a module is loaded
     * @param {string} modulePath
     * @returns {boolean}
     */
    isModuleLoaded(modulePath) {
        return modulePath in this._oolModules;
    }

    /**
     * Get a loaded oolone module
     * @param {string} modulePath
     * @returns {*}
     */
    getModule(modulePath) {
        return this._oolModules[modulePath];
    }

    /**
     * Start linking oolong files
     * @param {string} entryFileName
     * @returns {OolongLinker}
     */
    link(entryFileName) {
        //compile entry file
        let entryFile = path.resolve(this.currentAppModule.oolongPath, `${entryFileName}`);
        let entryModule = this.loadModule(entryFile);

        if (!entryModule) {
            throw new Error(`Cannot resolve file "${entryFile}".`);
        }

        if (!entryModule.schema) {
            throw new Error('No schema defined in entry file.');
        }

        if (entryModule.schema.name !== entryModule.name) {
            throw new Error(`Schema "${entryModule.schema.name}" defined in "${entryFileName}" should be the same with filename.`);
        }

        this.schema = new Schema(this, entryModule);
        this.schema.link();

        this._addRelatedEntities();
        
        return this;
    }

    /**
     * Load a oolong module
     * @param {string} modulePath
     * @returns {*}
     */
    loadModule(modulePath) {
        modulePath = path.resolve(modulePath);

        if (this.isModuleLoaded(modulePath)) {
            return this.getModule(modulePath);
        }

        if (!fs.existsSync(modulePath)) {
            return undefined;
        }

        let ool = this._compile(modulePath);

        return (this._oolModules[modulePath] = ool);
    }

    /**
     * Get the referenced entity, add it into schema if not in schema
     * @param {*} fromOolModule
     * @param {string} entityName
     * @returns {*}
     */
    getReferencedEntity(fromOolModule, entityName) {
        let entity = this.loadEntity(fromOolModule, entityName);

        if (!this.schema.hasEntity(entity.name)) {
            this.schema.addEntity(entity);
        }

        return entity;
    }

    /**
     * Load an entity from a oolong module
     * @param {*} oolModule
     * @param {string} entityName
     * @returns {*}
     */
    loadEntity(oolModule, entityName) {
        let entityRefId = entityName + '@' + oolModule.id;
        if (entityRefId in this._entityCache) {
            return this._entityCache[entityRefId];
        }

        let moduleName = undefined;
        let entityModule;
        
        this.log('debug','Loading entity: ' + entityName);

        if (oolModule.entity && entityName in oolModule.entity) {
            entityModule = oolModule;
        } else {
            let index = _.findLastIndex(oolModule.namespace, ns => {
                let modulePath;

                if (ns.endsWith('*')) {
                    if (moduleName) {
                        modulePath = path.join(ns.substr(0, ns.length-1), moduleName + '.ool');
                    } else {
                        return undefined;
                    }
                } else {
                    modulePath = moduleName ?
                        path.join(ns, moduleName + '.ool') :
                    ns + '.ool';
                }

                this.log('debug', 'Searching: ' + modulePath + ' for ' + entityName);

                entityModule = this.loadModule(modulePath);

                return entityModule && entityModule.entity && (entityName in entityModule.entity);
            });

            if (index === -1) {
                throw new Error(`Entity reference "${entityName}" in "${oolModule.id}" not found.`);
            }
        }

        let entity = entityModule.entity[entityName];
        if (!(entity instanceof Entity)) {
            let uniqueName = 'E$' + entityName;

            if (this._namingTable.has(uniqueName)) {
                throw new Error(`Entity "${entityName}" from "${entityModule.id}" conflicts with the same naming in "${this._namingTable.get(uniqueName).id}"!`);
            }

            entity = (new Entity(this, entityName, entityModule, entity)).link();
            entityModule.entity[entityName] = entity;

            this._namingTable.set(uniqueName, entityModule);
        }

        this._entityCache[entityRefId] = entity;
        
        return entity;
    }

    /**
     * Load a view from an oolong module
     * @param {*} oolModule - The module in which the view reference appears
     * @param {string} viewName
     * @returns {*}
     */
    loadView(oolModule, viewName) {
        let viewRefId = viewName + '@' + oolModule.id;
        if (viewRefId in this._viewCache) {
            return this._viewCache[viewRefId];
        }        

        let viewModule;

        this.log('debug','Loading view: ' + viewName);
        
        let index = _.findLastIndex(oolModule.namespace, ns => {
            if (ns.endsWith('*')) return undefined;

            let modulePath = ns + '.ool';

            this.log('debug', 'Searching: ' + modulePath + ' for ' + viewName);

            viewModule = this.loadModule(modulePath);

            return viewModule && viewModule.view && (viewName in viewModule.view);
        });

        if (index === -1) {
            throw new Error(`View reference "${viewName}" in "${oolModule.id}" not found.`);
        }

        let view = viewModule.view[viewName];
        if (!(view instanceof View)) {
            let uniqueName = 'V$' + viewName;
            if (this._namingTable.has(uniqueName)) {
                throw new Error(`View "${viewName}" from "${viewModule.id}" conflicts with the same naming in "${this._namingTable.get(uniqueName).id}"!`);
            }

            view = (new View(this, viewName, viewModule, view)).link();
            viewModule.view[viewName] = view;

            this._namingTable.set(uniqueName, viewModule);
        }

        this._viewCache[viewRefId] = view;

        return view;
    }

    /**
     * Load a document from an oolong module
     * @param {*} oolModule - The module in which the document reference appears
     * @param {string} docName
     * @returns {*}
     */
    loadDoc(oolModule, docName) {
        let docRefId = docName + '@' + oolModule.id;
        if (docRefId in this._docCache) {
            return this._docCache[docRefId];
        }

        let docModule;

        this.log('debug','Loading document: ' + docName);

        let index = _.findLastIndex(oolModule.namespace, ns => {
            if (ns.endsWith('*')) return undefined;

            let modulePath = ns + '.ool';

            this.log('debug', 'Searching: ' + modulePath + ' for ' + docName);

            docModule = this.loadModule(modulePath);

            return docModule && docModule.document && (docName in docModule.document);
        });

        if (index === -1) {
            throw new Error(`Document reference "${docName}" in "${oolModule.id}" not found.`);
        }

        let document = docModule.document[docName];
        if (!(document instanceof Document)) {
            let uniqueName = 'D$' + docName;
            if (this._namingTable.has(uniqueName)) {
                throw new Error(`Document "${docName}" from "${docModule.id}" conflicts with the same naming in "${this._namingTable.get(uniqueName).id}"!`);
            }

            document = (new Document(this, docName, docModule, document)).link();
            docModule.document[docName] = document;

            this._namingTable.set(uniqueName, docModule);
        }

        this._docCache[docRefId] = document;

        return document;
    }

    /**
     * Load a type definition
     * @param {*} oolModule
     * @param {string} typeName
     * @returns {object}
     */
    loadType(oolModule, typeName) {
        let typeRefId = typeName + '@' + oolModule.id;
        if (typeRefId in this._typeCache) {
            return this._typeCache[typeRefId];
        }

        let moduleName = undefined;
        let typeModule;

        this.log('debug', 'Loading type: ' + typeName);

        if (!moduleName && oolModule.type && typeName in oolModule.type) {
            typeModule = oolModule;
        } else {
            let index = _.findLastIndex(oolModule.namespace, ns => {
                let modulePath;

                if (ns.endsWith('*')) {
                    if (moduleName) {
                        modulePath = path.join(ns.substr(0, -1), moduleName + '.ool');
                    } else {
                        return undefined;
                    }
                } else {
                    modulePath = moduleName ?
                        path.join(ns, moduleName + '.ool') :
                    ns + '.ool';
                }

                this.log('debug', 'Searching: ' + modulePath);

                typeModule = this.loadModule(modulePath);

                return typeModule && typeModule.type && (typeName in typeModule.type);
            });

            if (index === -1) {
                throw new Error(`Type reference "${typeName}" in "${oolModule.id}" not found.`);
            }
        }

        let result = { oolModule: typeModule, name: typeName };

        let uniqueName = 'T$' + typeName;
        if (this._namingTable.has(uniqueName)) {
            let modId = this._namingTable.get(uniqueName).id;
            if (modId !== typeModule.id) {
                throw new Error(`Type "${typeName}" from "${typeModule.id}" conflicts with the same naming in "${modId}"!`);
            }
        } else {
            this._namingTable.set(uniqueName, typeModule);
        }

        this._typeCache[typeRefId] = result;

        return result;
    }

    /**
     * Track back the type derived chain
     * @param {*} oolModule
     * @param {object} info
     * @returns {object}
     */
    trackBackType(oolModule, info) {
        if (Oolong.BUILTIN_TYPES.has(info.type)) {
            return info;
        }

        let baseType = this.loadType(oolModule, info.type);
        let baseInfo = baseType.oolModule.type[baseType.name];

        if (!Oolong.BUILTIN_TYPES.has(baseInfo.type)) {
            //the base type is not a builtin type
            baseInfo = this.trackBackType(baseType.oolModule, baseInfo);
            baseType.oolModule.type[baseType.name] = baseInfo;
        }

        let derivedInfo = Object.assign({}, baseInfo, _.omit(info, 'type'));
        if (!derivedInfo.subClass) {
            derivedInfo.subClass = [];
        }
        derivedInfo.subClass.push(info.type);
        return derivedInfo;
    }    
    
    translateOolValue(oolModule, value) {
        if (_.isPlainObject(value)) {
            if (value.oolType === 'ConstReference') {
                return this._loadElement(oolModule, 'const', value.name);
            }

            return _.mapValues(value, v => this.translateOolValue(oolModule, v));
        }

        if (Array.isArray(value)) {
            return value.map(v => this.translateOolValue(oolModule, v));
        }

        return value;
    }

    _loadElement(oolModule, elementType, elementName) {
        let elementRefId = elementName + '#' + elementType + '@' + oolModule.id;
        if (elementRefId in this._elementsCache) {
            return this._elementsCache[elementRefId];
        }

        let targetModule;

        this.log('debug', `Loading ${elementType}: ${elementName}`);

        if (elementType in oolModule && elementName in oolModule[elementType]) {
            targetModule = oolModule;
        } else {
            let index = _.findLastIndex(oolModule.namespace, ns => {
                if (ns.endsWith('*')) return undefined;

                let modulePath = ns + '.ool';

                this.log('debug', `Searching "${modulePath}" for ${elementType} "${elementName}" ...`);

                targetModule = this.loadModule(modulePath);

                return targetModule && targetModule[elementType] && (elementName in targetModule[elementType]);
            });

            if (index === -1) {
                throw new Error(`${elementType} reference "${elementName}" in "${oolModule.id}" not found.`);
            }
        }

        return this._elementsCache[elementRefId] = targetModule[elementType][elementName];
    }

    _compile(oolFile) {
        this.log('debug', 'Compiling ' + oolFile + ' ...');

        let coreEntitiesPath = path.resolve(__dirname, 'core', 'entities');
        let oolongEntitiesPath = path.join(coreEntitiesPath, 'oolong');
        let isCoreEntity = _.startsWith(oolFile, coreEntitiesPath);
        
        oolFile = path.resolve(oolFile);
        let ool;
        try {
            ool = OolongParser.parse(fs.readFileSync(oolFile, 'utf8'));
        } catch (error) {
            throw new Error(`Failed to compile "${ oolFile }".\n${ error.message || error }`)
        }

        if (!ool) {
            throw new Error('Unknown error occurred while compiling.');
        }        

        let namespace;

        if (!_.startsWith(oolFile, oolongEntitiesPath)) {
            //Insert core entities path into namespace
            //let files = glob.sync(path.join(__dirname, 'core/entities', '*.ool'), {nodir: true});
            namespace = [ oolongEntitiesPath ];
        } else {
            namespace = [];
        }

        let currentPath = path.dirname(oolFile);

        function expandNs(namespaces, ns, recursive) {
            if (ns.endsWith('.ool')) {
                namespaces.push(ns.substr(0, ns.length-4));
                return;
            }

            if (fs.existsSync(ns + '.ool')) {
                namespaces.push(ns);
                return;
            }

            if (fs.statSync(ns).isDirectory()) {
                namespaces.push(path.join(ns, '*'));

                if (recursive) {
                    let files = fs.readdirSync(ns);
                    files.forEach(f => expandNs(namespaces, path.join(ns, f), true));
                }
            }
        }

        if (ool.namespace) {
            ool.namespace.forEach(ns => {
                let p;

                if (ns.endsWith('/*')) {
                    p = path.resolve(currentPath, ns.substr(0, ns.length - 2));
                    let files = fs.readdirSync(p);
                    files.forEach(f => expandNs(namespace, path.join(p, f), false));
                } else if (ns.endsWith('/**')) {
                    p = path.resolve(currentPath, ns.substr(0, ns.length - 3));
                    let files = fs.readdirSync(p);
                    files.forEach(f => expandNs(namespace, path.join(p, f), true));
                } else {
                    expandNs(namespace, path.resolve(currentPath, ns));
                }
            });
        }

        let currentNamespace = path.join(currentPath, '*');

        if (namespace.indexOf(currentNamespace) === -1) {
            namespace.push(currentNamespace);
        }

        let baseName = path.basename(oolFile, '.ool');

        ool.id = isCoreEntity
            ? path.relative(coreEntitiesPath, oolFile)
            : './' + path.relative(this.currentAppModule.oolongPath, oolFile);
        ool.namespace = namespace;
        ool.name = baseName;
        ool.path = currentPath;      
        
        let jsFile = oolFile + '.json';
        fs.writeFileSync(jsFile, JSON.stringify(ool, null, 4));

        return ool;
    }

    _addRelatedEntities() {
        this.log('debug', 'Finding referenced entities ...');

        //using bfs to find all connected entities
        let nodes = {}, beReferenced = {};

        const extractNodesByRelation = (ool, relationInfo, leftEntity, rightName, extraRelationOpt) => {
            let rightEntity = this.loadEntity(ool, rightName);
            let relation = Object.assign({}, relationInfo, {left: leftEntity, right: rightEntity}, extraRelationOpt);
            let leftPayload = {to: rightEntity.name, by: relation};

            if (!nodes[leftEntity.name]) {
                nodes[leftEntity.name] = [leftPayload];
            } else {
                nodes[leftEntity.name].push(leftPayload);
            }

            if (!beReferenced[rightEntity.name]) {
                beReferenced[rightEntity.name] = [leftEntity.name];
            } else {
                beReferenced[rightEntity.name].push(leftEntity.name);
            }

            return rightEntity;
        };

        //construct the connection status of nodes
        _.each(this._oolModules, ool => {
            if (ool.relation) {

                ool.relation.forEach(r => {
                    let leftEntity = this.loadEntity(ool, r.left);

                    if (_.isObject(r.right)) {

                        if (r.type === 'chain') {
                            _.each(r.right, (rightOpt, rightName) => {
                                leftEntity = extractNodesByRelation(ool, r, leftEntity, rightName, rightOpt);
                            });
                        } else  if (r.type === 'multi') {
                            _.each(r.right, rightName => {
                                extractNodesByRelation(ool, r, leftEntity, rightName, { multi: r.right });
                            });
                        }
                    } else {
                        extractNodesByRelation(ool, r, leftEntity, r.right);
                    }
                });
            }
        });

        //starting from schema to add all referenced entities
        let pending = new Set(), visited = new Set();

        Object.keys(this.schema.entities).forEach(entityName => pending.add(entityName));

        while (pending.size > 0) {
            let expanding = pending;
            pending = new Set();

            expanding.forEach(id => {
                if (visited.has(id)) return;

                let connections = nodes[id];

                if (connections) {
                    connections.forEach(c => {
                        pending.add(c.to);
                        this.schema.addRelation(c.by);
                    });
                }

                visited.add(id);
            });
        }

        //todo: more, finding the single way relation chain
    }
}

module.exports = OolongLinker;