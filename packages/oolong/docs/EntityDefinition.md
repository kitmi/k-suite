# Entity Definition

## code

## features

* atLeastOneNotNull
* autoId
* createTimestamp
* i18n
* logicalDeletion
* stateTracking
* updateTimestamp

## fields

### field qualifier

* any
    * code
    * optional
    * default
    * auto
    * readOnly
    * writeOnce
    * forceUpdate

* int
    * bytes
    * digits    
    * unsigned

* number    
    * exact
    * totalDigits
    * decimalDigits

* text
    * fixedLength
    * maxLength
    * encoding

### field modifiers

* validator
    * syntax: |~
* processor
    * syntax: |>
* activator
    * syntax: |=

## relationship (associations)

* hasOne - user.profile
* hasMany - user.groups
* belongsTo - profile.user
* refersTo - profile.gender, entity.code

## key

## indexes

Index does not include foreign keys which are covered by associations.

