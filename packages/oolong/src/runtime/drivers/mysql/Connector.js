const { _, eachAsync_ } = require('rk-utils');
const { tryRequire } = require('@k-suite/app/lib/utils/Helpers');
const mysql = tryRequire('mysql2/promise');
const Connector = require('../../Connector');
const { OolongUsageError, DsOperationError } = require('../../Errors');
const { isQuoted, isPrimitive } = require('../../../utils/lang');

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
    constructor(connectionString, options) {        
        super('mysql', connectionString, options);

        this._pools = {};
        this._acitveConnections = new Map();
    }

    stringFromConnection(conn) {
        post: !conn || it, 'Connection object not found in acitve connections map.'; 
        return this._acitveConnections.get(conn);
    }    

    /**
     * Close all connection initiated by this connector.
     */
    async end_() {
        for (let conn of this._acitveConnections.keys()) {
            await this.disconnect_(conn);
        };

        return eachAsync_(this._pools, async (pool, cs) => {
            await pool.end();
            this.log('debug', 'Closed pool: ' + cs);
        });
    }

    /**
     * Create a database connection based on the default connection string of the connector and given options.     
     * @param {Object} [options] - Extra options for the connection, optional.
     * @property {bool} [options.multipleStatements=false] - Allow running multiple statements at a time.
     * @property {bool} [options.createDatabase=false] - Flag to used when creating a database.
     * @returns {Promise.<MySQLConnection>}
     */
    async connect_(options) {
        let csKey = this.connectionString;

        if (options) {
            let connProps = {};

            if (options.createDatabase) {
                //remove the database from connection
                connProps.database = '';
            }
            
            connProps.options = _.pick(options, ['multipleStatements']);     

            csKey = this.getNewConnectionString(connProps);
        }        

        let pool = this._pools[csKey];

        if (!pool) {            
            pool = mysql.createPool(csKey);
            this._pools[csKey] = pool;

            this.log('debug', 'Created pool: ' + csKey);
        }        

        let conn = await pool.getConnection();
        this._acitveConnections.set(conn, csKey);

        this.log('debug', 'Create connection: ' + csKey);
        
        return conn;
    }

    /**
     * Close a database connection.
     * @param {MySQLConnection} conn - MySQL connection.
     */
    async disconnect_(conn) {        
        let cs = this.stringFromConnection(conn);
        this._acitveConnections.delete(conn);

        this.log('debug', 'Close connection: ' + (cs || '*unknown*'));        
        return conn.release();     
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

            await conn.query('SET SESSION TRANSACTION ISOLATION LEVEL ' + isolationLevel);            
        }

        await conn.beginTransaction();
        
        this.log('debug', 'Begins a new transaction.');
        return conn;
    }

    /**
     * Commit a transaction.
     * @param {MySQLConnection} conn - MySQL connection.
     */
    async commit_(conn) {
        await conn.commit();
        
        this.log('debug', 'Commits a transaction.');
        return this.disconnect_(conn);
    }

    /**
     * Rollback a transaction.
     * @param {MySQLConnection} conn - MySQL connection.
     */
    async rollback_(conn) {
        await conn.rollback();
        
        this.log('debug', 'Rollbacks a transaction.');
        return this.disconnect_(conn);
    }

    /**
     * Execute the sql statement.
     *
     * @param {String} sql The SQL statement
     */
    async execute_(sql, params, options) {        
        let conn, formatedSQL;

        try {
            conn = await this._getConnection_(options);

            formatedSQL = params ? conn.format(sql, params) : sql;

            if (this.options.logSQLStatement) {
                this.log('verbose', formatedSQL);
            }

            let [ result ] = await conn.query(formatedSQL);                
            return result;
        } catch (err) {      
            throw new DsOperationError(err.message, { error: err, connection: this.stringFromConnection(conn), sql: formatedSQL });
        } finally {
            conn && await this._releaseConnection_(conn, options);
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
     * Replace an existing entity or create a new one.
     * @param {string} model 
     * @param {object} data 
     * @param {*} options 
     */
    async replace_(model, data, options) {        
        let params = [ model, data ]; 

        let sql = 'REPLACE ?? SET ?';

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
     * Perform select operation.
     * @param {*} model 
     * @param {*} condition 
     * @param {*} options 
     */
    async find_(model, { $select, $where, $groupBy, $having, $orderBy, $offset, $limit }, options) {
        let params = [ model ];

        let whereClause = $where && this._joinCondition($where, params);
        
        let sql = 'SELECT ' + ($select ? this._buildColumns($select) : '*') + ' FROM ??';
        if (whereClause) {
            sql += ' WHERE ' + whereClause;
        }

        if ($groupBy) {
            sql += ' ' + this._buildGroupBy($groupBy);
        }

        if ($having) {
            let havingClause = this._joinCondition($having, params);
            if (havingClause) {
                sql += ' HAVING ' + havingClause;
            }
        }

        if ($orderBy) {
            sql += ' ' + this._buildOrderBy($orderBy);
        }

        if (_.isInteger($limit) && $limit > 0) {
            sql += ' LIMIT ?';
            params.push($limit);
        }

        if (_.isInteger($offset) && $offset > 0) {            
            sql += ' OFFSET ?';
            params.push($offset);
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