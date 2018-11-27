const { _ } = require('rk-utils');
const { tryRequire } = require('@k-suite/app/lib/utils/Helpers');
const mysql = require('mysql2/promise');
const Connector = require('../../Connector');
const { OolongUsageError, DsOperationError } = require('../../Errors');
const { isQuoted, isPrimitive } = require('../../../utils/lang');

const poolByConn = {};

/**
 * MySQL data storage connector.
 * @class
 * @extends Connector
 */
class MySQLConnector extends Connector {
    /**
     * Transaction isolation level
     * {@link https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html}
     * @member {object}
     */
    IsolationLevels = Object.freeze({
        RepeatableRead: 'REPEATABLE READ',
        ReadCommitted: 'READ COMMITTED',
        ReadUncommitted: 'READ UNCOMMITTED',
        Rerializable: 'SERIALIZABLE'
    });       

    /**          
     * @param {string} name 
     * @param {object} options 
     */
    constructor(name, options) {
        super('mysql', name, Object.assign({ multipleStatements: 1 }, options));

        if (this.options.multipleStatements) {
            this.updateConnectionComponents({ options: { multipleStatements: 1 } });
        }
    }

    /**
     * Create a database connection.     
     * @param {Object} [options] - Extra options for the connection, optional.
     * @property {bool} [options.createDatabase=false] - Connect without specifying database, used only in createDatabase.
     * @returns {Promise.<MySQLConnection>}
     */
    async connect_(options) {
        let pool = poolByConn[this.connectionString];

        if (!pool) {            
            pool = poolByConn[this.connectionString] = mysql.createPool(this.connectionString);
            this.log('debug', 'Created pool: ' + this.connectionString);
        }   
        
        this.log('debug', 'Create connection: ' + this.connectionString);

        Object.defineProperty(this, 'connectionString', { writable: false });

        return pool.getConnection();
    }

    /**
     * Close a database connection.
     * @param {MySQLConnection} conn - MySQL connection.
     */
    async disconnect_(conn) {
        this.log('debug', 'Close connection: ' + this.connectionString);
        return conn.release();     
    }

    /**
     * Terminate the connector.
     */
    async end_() {
        const cs = this.connectionString;

        if (poolByConn[cs]) {                 
            await poolByConn[cs].end();
            delete poolByConn[cs];

            this.log('debug', 'Removed pool: ' + cs);
        }
    }

    /**
     * Start a transaction.
     * @param {object} options - Options
     * @property {string} [options.isolationLevel]
     */
    async beginTransaction_(options) {
        let conn = await this.connect_();

        if (options && options.isolationLevel) {
            //only allow valid option value to avoid injection attach
            let isolationLevel = _.find(this.IsolationLevels, (value, key) => options.isolationLevel === key || options.isolationLevel === value);
            if (!isolationLevel) {
                throw new OolongUsageError(`Invalid isolation level: "${isolationLevel}"!"`);
            }

            let [result] = await conn.query('SET SESSION TRANSACTION ISOLATION LEVEL ' + isolationLevel);            
        }

        await conn.beginTransaction();
        return conn;
    }

    /**
     * Commit a transaction.
     * @param {MySQLConnection} conn - MySQL connection.
     */
    async commit_(conn) {
        let [result] = await conn.commit();
        return this.disconnect_(conn);
    }

    /**
     * Rollback a transaction.
     * @param {MySQLConnection} conn - MySQL connection.
     */
    async rollback_(conn) {
        let [result] = await conn.rollback();
        return this.disconnect_(conn);
    }

    /**
     * Execute the sql statement.
     *
     * @param {String} sql The SQL statement
     */
    async execute_(sql, params, options) {        
        if (options && options.createDatabase) {
            let connector = new MySQLConnector(this.name, { connection: this.connectionString, ...this.options });
            connector.updateConnectionComponents({ database: '' });
            let result = await connector.execute_(sql, params);            
            await connector.end_();
            return result;
        }

        let conn;

        try {
            conn = await this._getConnection_(options);

            let formatedSQL = conn.format(sql, params);

            if (this.options.logSQLStatement) {
                this.log('verbose', formatedSQL);
            }

            let [ result ] = await conn.query(formatedSQL);                
            return result;
        } catch (err) {      
            throw new DsOperationError(err.message, err);
        } finally {
            conn && await this._releaseConnection_(conn);
        }
    }

    async ping_() {
        let [ ping ] = await this.execute_('SELECT 1 AS result');
        return ping && ping.result === 1;
    }

    /**
     * Create a new entity.
     * @param {string} model 
     * @param {object} data 
     * @param {*} options 
     */
    async create_(model, data, options) {
        let sql = 'INSERT INTO ?? SET ?';
        let params = [ model ];
        params.push(data);

        return this.execute_(sql, params, options); 
    }

    /**
     * Update an existing entity.
     * @param {string} model 
     * @param {object} data 
     * @param {*} condition 
     * @param {*} options 
     */
    async update_(model, data, condition, options) {        
        let params = [ model, data ]; 

        let whereClause = this._joinCondition(condition, params);        

        let sql = 'UPDATE ?? SET ? WHERE ' + whereClause;

        return this.execute_(sql, params, options);
    }

    /**
     * Remove an existing entity.
     * @param {string} model 
     * @param {*} condition 
     * @param {*} options 
     */
    async delete_(model, condition, options) {
        let params = [ model ];

        let whereClause = this._joinCondition(condition, params);        

        let sql = 'DELETE FROM ?? WHERE ' + whereClause;
        
        return this.execute_(sql, params, options);
    }

    /**
     * 
     * @param {*} model 
     * @param {*} condition 
     * @param {*} options 
     */
    async find_(model, { columns, where, groupBy, orderBy, limitOffset },  options) {
        let params = [ model ];

        let whereClause = where && this._joinCondition(where, params);
        
        let sql = 'SELECT ' + (columns ? this._buildColumns(columns) : '*') + ' FROM ??';
        if (whereClause) {
            sql += ' WHERE ' + whereClause;
        }

        if (groupBy) {
            sql += ' ' + this._buildGroupBy(groupBy);
        }

        if (orderBy) {
            sql += ' ' + this._buildOrderBy(orderBy);
        }

        if (limitOffset) {
            sql += ' ' + this._buildLimitOffset(limitOffset);
        }

        return this.execute_(sql, params, options);
    }

    getInsertedId(result) {
        return result && typeof result.insertId === 'number' ?
            result.insertId : 
            undefined;
    }

    getNumOfAffectedRows(result) {
        return result && typeof result.affectedRows === 'number' ?
            result.affectedRows : 
            undefined;
    }

    /**
     * SQL condition representation
     *   Rules:
     *     default: 
     *        array: OR
     *        kv-pair: AND
     *     $all: 
     *        array: AND
     *     $any:
     *        kv-pair: OR
     *     $not:
     *        array: not ( or )
     *        kv-pair: not ( and )     
     * @param {object} condition 
     * @param {array} valuesSeq 
     */
    _joinCondition(condition, valuesSeq, joinOperator) {
        if (Array.isArray(condition)) {
            if (!joinOperator) {
                joinOperator = 'OR';
            }
            return condition.map(c => this._joinCondition(c, valuesSeq)).join(` ${joinOperator} `);
        }

        if (_.isPlainObject(condition)) { 
            if (!joinOperator) {
                joinOperator = 'AND';
            }
            
            return _.map(condition, (value, key) => {
                if (key === '$all' || key === '$and') {
                    assert: Array.isArray(value) || _.isPlainObject(value), '"$and" operator value should be an array or plain object.';                    

                    return this._joinCondition(value, valuesSeq, 'AND');
                }
    
                if (key === '$any' || key === '$or') {
                    assert: Array.isArray(value) || _.isPlainObject(value), '"$or" operator value should be a plain object.';       
                    
                    return this._joinCondition(value, valuesSeq, 'OR');
                }

                if (key === '$not') {                    
                    if (Array.isArray(value)) {
                        assert: value.length > 0, '"$not" operator value should be non-empty.';                     

                        return 'NOT (' + this._joinCondition(value, valuesSeq) + ')';
                    } 
                    
                    if (_.isPlainObject(value)) {
                        let numOfElement = Object.keys(value).length;   
                        assert: numOfElement > 0, '"$not" operator value should be non-empty.';                     

                        return 'NOT (' + this._joinCondition(value, valuesSeq) + ')';
                    } 

                    assert: typeof value === 'string', 'Unsupported condition!';

                    return 'NOT (' + condition + ')';                    
                }                

                return this._wrapCondition(key, value, valuesSeq);
            }).join(` ${joinOperator} `);
        }

        assert: typeof condition === 'string', 'Unsupported condition!';

        return condition;
    }

    /**
     * Wrap a condition clause     
     * 
     * Value can be a literal or a plain condition object.
     *   1. fieldName, <literal>
     *   2. fieldName, { normal object } 
     * 
     * @param {string} fieldName 
     * @param {*} value 
     * @param {array} valuesSeq  
     */
    _wrapCondition(fieldName, value, valuesSeq) {
        if (_.isNil(value)) {
            return mysql.escapeId(fieldName) + ' IS NULL';
        }

        if (_.isPlainObject(value)) {
            let hasOperator = _.find(Object.keys(value), k => k && k[0] === '$');

            if (hasOperator) {
                return _.map(value, (v, k) => {
                    if (k && k[0] === '$') {
                        // operator
                        switch (k) {
                            case '$eq':
                            case '$equal':
    
                            return this._wrapCondition(fieldName, v, valuesSeq);
    
                            case '$ne':
                            case '$neq':
                            case '$notEqual':         
    
                            if (_.isNil(v)) {
                                return mysql.escapeId(fieldName) + ' IS NOT NULL';
                            }          
    
                            if (isPrimitive(v)) {
                                valuesSeq.push(v);
                                return mysql.escapeId(fieldName) + ' <> ?';
                            }
    
                            return 'NOT (' + this._wrapCondition(fieldName, v, valuesSeq) + ')';
    
                            case '$>':
                            case '$gt':
                            case '$greaterThan':
    
                            if (!_.isFinite(v)) {
                                throw new Error('Only finite numbers can use "$gt" or "$>" operator.');
                            }
    
                            valuesSeq.push(v);
                            return mysql.escapeId(fieldName) + ' > ?';
    
                            case '$>=':
                            case '$gte':
                            case '$greaterThanOrEqual':
                            
                            if (!_.isFinite(v)) {
                                throw new Error('Only finite numbers can use "$gte" or "$>=" operator.');
                            }
    
                            valuesSeq.push(v);
                            return mysql.escapeId(fieldName) + ' >= ?';
    
                            case '$<':
                            case '$lt':
                            case '$lessThan':
                            
                            if (!_.isFinite(v)) {
                                throw new Error('Only finite numbers can use "$gte" or "$<" operator.');
                            }
    
                            valuesSeq.push(v);
                            return mysql.escapeId(fieldName) + ' < ?';
    
                            case '$<=':
                            case '$lte':
                            case '$lessThanOrEqual':
                            
                            if (!_.isFinite(v)) {
                                throw new Error('Only finite numbers can use "$lte" or "$<=" operator.');
                            }
    
                            valuesSeq.push(v);
                            return mysql.escapeId(fieldName) + ' <= ?';
    
                            case '$in':
    
                            if (!Array.isArray(v)) {
                                throw new Error('The value should be an array when using "$in" operator.');
                            }
    
                            valuesSeq.push(v);
                            return mysql.escapeId(fieldName) + ' IN ?';
    
                            case '$nin':
                            case '$notIn':
    
                            if (!Array.isArray(v)) {
                                throw new Error('The value should be an array when using "$in" operator.');
                            }
    
                            valuesSeq.push(v);
                            return mysql.escapeId(fieldName) + ' NOT IN ?';
    
                            default:
                            throw new Error(`Unsupported condition operator: "${k}"!`);
                        }
                    } else {
                        throw new Error('Operator should not be mixed with condition value.');
                    }
                }).join(' AND ');
            }  

            valuesSeq.push(JSON.stringify(value));
            return mysql.escapeId(fieldName) + ' = ?';
        }

        valuesSeq.push(value);
        return mysql.escapeId(fieldName) + ' = ?';
    }

    _buildColumns(columns) {        
        return _.map(_.castArray(columns), col => this._buildColumn(col)).join(', ');
    }

    _buildColumn(col) {
        if (typeof col === 'string') {  
            //it's a string if it's quoted when passed in          
            return (isQuoted(col) || col === '*') ? col : mysql.escapeId(col);
        }

        if (typeof col === 'number') {
            return col;
        }

        if (_.isPlainObject(col)) {
            if (col.alias && typeof col.alias === 'string') {
                return this._buildColumn(_.omit(col, ['alias'])) + ' AS ' + mysql.escapeId(col.alias);
            } 
            
            if (col.type === 'function') {
                return col.name + '(' + (col.args ? this._buildColumns(col.args) : '') + ')';
            }            
        }

        throw new OolongUsageError(`Unknow column syntax: ${JSON.stringify(col)}`);
    }

    _buildGroupBy(groupBy, params) {
        if (typeof groupBy === 'string') return 'GROUP BY ' + mysql.escapeId(groupBy);

        if (Array.isArray(groupBy)) return 'GROUP BY ' + groupBy.map(by => mysql.escapeId(by)).join(', ');

        if (_.isPlainObject(groupBy)) {
            let { columns, having } = groupBy;

            if (!columns || !Array.isArray(columns)) {
                throw new OolongUsageError(`Invalid group by syntax: ${JSON.stringify(groupBy)}`);
            } 

            let groupByClause = this._buildGroupBy(columns);
            let havingCluse = having && this._joinCondition(having, params);
            if (havingCluse) {
                groupByClause += ' HAVING ' + havingCluse;
            }

            return groupByClause;
        }

        throw new OolongUsageError(`Unknown group by syntax: ${JSON.stringify(groupBy)}`);
    }

    _buildOrderBy(orderBy) {
        if (typeof orderBy === 'string') return 'ORDER BY ' + mysql.escapeId(orderBy);

        if (Array.isArray(orderBy)) return 'ORDER BY ' + orderBy.map(by => mysql.escapeId(by)).join(', ');

        if (_.isPlainObject(orderBy)) {
            return 'ORDER BY ' + _.map(orderBy, (asc, col) => mysql.escapeId(col) + (asc ? '' : ' DESC')).join(', '); 
        }

        throw new OolongUsageError(`Unknown order by syntax: ${JSON.stringify(orderBy)}`);
    }

    _buildLimitOffset(limitOffset) {
        if (_.isInteger(limitOffset)) return `LIMIT ${limitOffset}`;

        if (_.isPlainObject(limitOffset)) {
            let { limit, offset } = limitOffset;
            return this._buildLimitOffset(limit) + (_.isInteger(offset) ? `, ${offset}` : '');
        }

        if (Array.isArray(limitOffset)) {
            let [ limit, offset ] = limitOffset;
            return this._buildLimitOffset({ limit, offset });
        }

        throw new OolongUsageError(`Unknown limitOffset syntax: ${JSON.stringify(limitOffset)}`);
    }

    async _getConnection_(options) {
        return (options && options.connection) ? options.connection : this.connect_(options);
    }

    async _releaseConnection_(conn, options) {
        if (!options || !options.connection) {
            return this.disconnect_(conn);
        }
    }
}

module.exports = MySQLConnector;