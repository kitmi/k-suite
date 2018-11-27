"use strict";

const Util = require('rk-utils');
const { _ } = Util; 

const MAP_ENTITY_NAMING = {
    't_bankaccount': 'BankAccount',
    't_cactnotification': 'CactNotification',
    't_cacttask': 'CactTask',
    't_case': 'Case',
    't_caseactivity': 'CaseActivity',
    't_casechange': 'CaseChange',
    't_code': 'Code',
    't_company': 'Company',
    't_companycompany': 'CompanyCompany',
    't_companyperson': 'CompanyPerson',
    't_document': 'Document',
    't_globalsetting': 'GlobalSetting',
    't_group': 'Group',
    't_groupresource': 'GroupResource',
    't_news': 'News',
    't_party': 'Party',
    't_partycompany': 'PartyCompany',
    't_partyperson': 'PartyPerson',
    't_person': 'Person',
    't_personperson': 'PersonPerson',
    't_polineitem': 'PolineItem',
    't_price': 'Price',
    't_promotion': 'Promotion',
    't_purchaseorder': 'PurchaseOrder',
    't_resource': 'Resource',
    't_reviewreply': 'ReviewReply',
    't_robotcontact': 'RobotContact',
    't_robotprofile': 'RobotProfile',
    't_service': 'Service',
    't_servicecategory': 'ServiceCategory',
    't_serviceorder': 'ServiceOrder',
    't_servicepackage': 'ServicePackage',
    't_servicereview': 'ServiceReview',
    't_solineitem': 'ServiceOrderLineItem',
    't_ucaccess': 'UserAccessControll',
    't_user': 'User',
    't_usergroup': 'UserGroup'
};

module.exports = {    
    entityNaming: (name) => {
        if (MAP_ENTITY_NAMING.hasOwnProperty(name)) {
            return _.camelCase(MAP_ENTITY_NAMING[name]);
        }

        //throw new Error('error');
        return _.camelCase(name);
    },
    columnTypeConversion: [        
        {
            desc: 'Converting field type being "int(11) unsigned" and field name ending with "_time" into "datetime"',
            test: function (table, col) {
                let colName = _.snakeCase(col.COLUMN_NAME);
                return _.endsWith(colName, '_time') && col.COLUMN_TYPE === 'int(11) unsigned';
            },
            apply: function (table, col) {
                return { type: 'datetime' };
            }
        },
        {
            desc: 'Converting field type being "text" and field name ending with "_url" into "url"',
            test: function (table, col) {
                let colName = _.snakeCase(col.COLUMN_NAME);
                return _.endsWith(colName, '_url') && col.COLUMN_TYPE === 't_ext';
            },
            apply: function (table, col) {
                return { type: 'url' };
            }
        },
        {
            desc: 'Converting field type being "varchar(255)" and field name ending with "_url" into "url"',
            test: function (table, col) {
                let colName = _.snakeCase(col.COLUMN_NAME);
                return _.endsWith(colName, '_url') && col.COLUMN_TYPE === 'varchar(255)';
            },
            apply: function (table, col) {
                return { type: 'url' };
            }
        }
    ]/*,
    columnTypeOptimization: [
        {
            desc: 'Converting field type being "int(11) unsigned" and field name ending with "_time" into "datetime"',
            test: function (table, col) {
                let colName = _.snakeCase(col.COLUMN_NAME);
                return _.endsWith(colName, '_time') && col.COLUMN_TYPE === 'int(11) unsigned';
            },
            apply: function (table, col) {
                return { type: 'datetime' };
            }
        }
    ]*/
};