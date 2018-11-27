# Entity Model

## static members

* db
    * defaultConnector - Getter
    * createNewConnector - Create a new connector, usually used for transaction
* meta - Metadata about the enttiy
    * knowledge 
        * dependsOnExisting
* i18n - I18n object

## operation context

* raw - Raw input data. 
* latest - Validated and sanitized data.
* existing - Existing data from database.
* i18n - I18n object.
* connector - Existing connector for chained operation.
* result - Operation result

## operation options

* connector - Transaction connector.