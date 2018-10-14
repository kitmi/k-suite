"use strict";

const path = require('path');

const Util = require('../../util.js');
const _ = Util._;

const OolUtils = require('./ool-utils.js');
const Entity = require('./entity.js');

class OolongDocument {
    /**
     * Oolong document
     * @constructs OolongDocument
     * @param {OolongLinker} linker
     * @param {string} name - Document name
     * @param {*} oolModule - Source ool module
     * @param {object} info - Document info
     */
    constructor(linker, name, oolModule, info) {
        //immutable
        /**
         * Linker to process this document
         * @type {OolongLinker}
         * @public
         */
        this.linker = linker;

        /**
         * Name of this document
         * @type {string}
         * @public
         */
        this.name = name;

        /**
         * Owner oolong module
         * @type {*}
         * @public
         */
        this.oolModule = oolModule;

        /**
         * Raw metadata
         * @type {Object}
         * @public
         */
        this.info = info;

        /**
         * The main entity of the document
         * @type {object}
         */
        this.mainEntity = undefined;

        /**
         * Joining entities
         * @type {array}
         */
        this.joinWith = undefined;

        /**
         * Flag of initialization
         * @type {boolean}
         * @public
         */
        this.initialized = false;
    }

    /**
     * Clone the document
     * @param {Map} [stack] - Reference stack to avoid recurrence copy
     * @returns {OolongDocument}
     */
    clone(stack) {
        if (!stack) stack = new Map();
        let cl = new OolongDocument(this.linker, this.name, this.oolModule, this.info);
        stack.set(this, cl);

        cl.mainEntity = this.mainEntity;
        OolUtils.deepCloneField(this, cl, 'joinWith', stack);

        cl.initialized = this.initialized;

        return cl;
    }

    /**
     * Start linking this document
     * @returns {OolongDocument}
     */
    link() {
        if (this.initialized) {
            return this;
        }

        if (this.info.entity) {
            let entity = this.linker.getReferencedEntity(this.oolModule, this.info.entity);
            this.mainEntity = entity.name;
        } else {
            let doc = this.linker.loadDoc(this.oolModule, this.info.document);
            this.mainEntity = doc.mainEntity;
            this.joinWith = doc.joinWith.concat();
        }
        
        if (!_.isEmpty(this.info.joinWith)) {
            if (!this.joinWith) {
                this.joinWith = this.info.joinWith.concat();
            } else {
                this.joinWith = this.joinWith.concat(this.info.joinWith);
            }
        }

        this.initialized = true;

        return this;
    }

    buildHierarchy(inSchema) {
        return this._flattenDocument(inSchema, this);
    }

    _flattenDocument(inSchema, document) {
        let hierarchy = {};
        let leftEntity = inSchema.entities[document.mainEntity];

        if (document.joinWith) {
            document.joinWith.forEach(joining => {
                let leftField, rightEntity, rightField;

                if (OolUtils.isMemberAccess(joining.on.left)) {
                    let lastPos = joining.on.left.lastIndexOf('.');
                    let fieldRef = joining.on.left.substr(lastPos+1);
                    let entityRef = joining.on.left.substr(0, lastPos);

                    if (entityRef === leftEntity.name) {
                        leftField = leftEntity.getEntityAttribute(fieldRef);
                    } else {
                        throw new Error(`Unsupported syntax of left side joining field "${joining.on.left}".`);
                    }

                } else {
                    //field of leftEntity
                    leftField = leftEntity.getEntityAttribute(joining.on.left);
                }

                if (joining.document) {
                    let rightHierarchy = inSchema.getDocumentHierachy(this.oolModule, joining.document);

                    if (OolUtils.isMemberAccess(joining.on.right)) {
                        let parts = joining.on.right.split('.');
                        if (parts.length > 2) {
                            throw new Error('Joining a document should only referencing to a field of its main entity.');
                        }

                        let [ entityRef, fieldRef ] = parts;

                        if (entityRef !== rightHierarchy.entity) {

                            throw new Error(`Referenced field "${joining.on.right}" not found while linking to document "${joining.document}".`);
                        }

                        assert: !hierarchy[leftField.name], 'Duplicate joinings on the same field of the left side entity.';

                        rightEntity = inSchema.entities[entityRef];
                        rightField = rightEntity.getEntityAttribute(fieldRef);

                        hierarchy[leftField.name] = Object.assign({}, rightHierarchy, {
                            linkWithField: rightField.name
                        });

                        return;
                    }

                    //joining.on.right is field name of the main entity
                    rightEntity = inSchema.entities[joining.document.mainEntity];
                } else {
                    rightEntity = inSchema.entities[joining.entity];

                    if (OolUtils.isMemberAccess(joining.on.right)) {
                        throw new Error(`Referenced field "${joining.on.right}" not found while linking to entity "${joining.entity}".`);
                    }
                }

                //field of rightEntity
                rightField = rightEntity.getEntityAttribute(joining.on.right);

                assert: !hierarchy[leftField.name], 'Duplicate joinings on the same field of the left side entity.';

                hierarchy[leftField.name] = {
                    oolType: 'DocumentHierarchyNode',
                    entity: rightEntity.name,
                    linkWithField: rightField.name
                };
            });
        }

        return {
            oolType: 'DocumentHierarchyNode',
            entity: leftEntity.name,
            subDocuments: hierarchy
        };
    }

    /**
     * Translate the document into a plain JSON object
     * @returns {object}
     */
    toJSON() {
        return {            
            name: this.name,
            mainEntity: this.mainEntity,
            joinWith: this.joinWith
        };
    }
}

module.exports = OolongDocument;