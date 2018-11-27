"use strict";

const { _ } = require('rk-utils');
const { generateDisplayName, deepCloneField, Clonable } = require('./OolUtils');

const Dataset = require('./Dataset');

/**
 * Oolong view class.
 * @class {OolongView}
 */
class View extends Clonable {

    isList = false;

    /**          
     * @param {OolongLinker} linker
     * @param {string} name - View name
     * @param {object} oolModule - Source ool module
     * @param {object} info - View info
     */
    constructor(linker, name, oolModule, info) {
        /**
         * Linker to process this view
         * @member {OolongLinker}
         */
        this.linker = linker;

        /**
         * Name of this view
         * @member {string}
         */
        this.name = name;

        /**
         * Owner oolong module
         * @member {object}
         */
        this.oolModule = oolModule;

        /**
         * Raw metadata
         * @member {Object}
         */
        this.info = info;        
    }

    /**
     * Start linking this view
     * @returns {OolongView}
     */
    link() {
        pre: !this.linked;

        if (this.info.dataset) {
            this.dataset = this.linker.loadDoc(this.oolModule, this.info.dataset);
        } else {
            assert: this.info.entity, 'Invalid view syntax!';
            
            let mainEntity = this.linker.getReferencedEntity(this.oolModule, this.info.entity);
            
            this.dataset = new Dataset(this.linker, mainEntity.name, this.oolModule, { mainEntity: mainEntity.name });
            this.dataset.link();
        }

        if (this.info.isList) {
            this.isList = true;
        }

        if (!_.isEmpty(this.info.accept)) {
            this.params = this.info.accept.concat();
        }

        if (!_.isEmpty(this.info.selectBy)) {
            this.selectBy = this.info.selectBy.concat();
        }

        if (!_.isEmpty(this.info.groupBy)) {
            this.groupBy = this.info.groupBy.concat();
        }

        if (!_.isEmpty(this.info.orderBy)) {
            this.orderBy = this.info.orderBy.concat();
        }

        if (this.info.skip) {
            this.skip = _.isPlainObject(this.info.skip) ? Object.assign({}, this.info.skip) : this.info.skip;
        }

        if (this.info.limit) {
            this.limit = _.isPlainObject(this.info.limit) ? Object.assign({}, this.info.limit) : this.info.limit;
        }

        this.linked = true;

        return this;
    }

    inferTypeInfo(inSchema) {
        if (!_.isEmpty(this.params)) {
            let inferredParams = [];

            this.params.forEach(param => {
                if (OolUtils.isMemberAccess(param.type)) {
                    let [ entityName, fieldName ] = param.type.split('.');

                    if (!inSchema.hasEntity(entityName)) {
                        throw new Error(`Parameter "${param.name}" references to an entity "${entityName}" which is not belong to the schema.`);
                    }

                    let entity = inSchema.entities[entityName];
                    //console.dir(entity.toJSON(), {depth: 8, colors: true});

                    let field = entity.getEntityAttribute(fieldName);
                    inferredParams.push(Object.assign(_.omit(_.toPlainObject(field), ['isReference', 'optional', 'displayName']), {name: param.name}));
                } else {
                    inferredParams.push(this.linker.trackBackType(this.oolModule, param));
                }
            });

            this.params = inferredParams;
        }
    }

    getDocumentHierarchy(inSchema) {
        return inSchema.getDocumentHierachy(this.oolModule, this.dataset.name);
    }

    /**
     * Clone the view     
     * @returns {OolongView}
     */
    clone() {
        super.clone();
        
        let view = new View(this.linker, this.name, this.oolModule, this.info);

        deepCloneField(this, view, 'dataset');
        deepCloneField(this, view, 'params');
        deepCloneField(this, view, 'selectBy');
        deepCloneField(this, view, 'groupBy');
        deepCloneField(this, view, 'orderBy');
        deepCloneField(this, view, 'skip');
        deepCloneField(this, view, 'limit');

        view.isList = this.isList;
        view.linked = true;

        return view;
    }
    
    /**
     * Translate the view into a plain JSON object
     * @returns {object}
     */
    toJSON() {
        return {            
            name: this.name,
            dataset: this.dataset.toJSON(),
            isList: this.isList,
            params: this.params,
            selectBy: this.selectBy,
            groupBy: this.groupBy,
            orderBy: this.orderBy,
            skip: this.skip,
            limit: this.limit
        };
    }
}

module.exports = View;