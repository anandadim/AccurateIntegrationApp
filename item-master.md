3. Item Master API
3.1 Get Item Master Data
Returns a paginated list of item masters with various filtering options.
Endpoint: GET /item-master/list
Request Parameters
Parameter	Type	Required	Description
search	string	No	Search by article_code or article_description
entity_code	string	No	Filter by entity / workspace code (SRN/SNJ/GFI)
article_code	string	No	Filter by article code
gtin_code	string	No	Filter by GTIN code
article_description	string	No	Filter by article description
division_name	string	No	Filter by division name
department_name	string	No	Filter by department name
category_name	string	No	Filter by category name
keyword	string	No	Search by article_code or article_description
article_uom	string	No	Filter by unit of measure
article_creation_date	date	No	Filter by creation date
per_page	integer	No	Number of items per page (default: 25)
page	integer	No	Page number for pagination (default: 1)
Request Example
GET /item-master/list?article_code=ITEM001&per_page=25&page=1
Response Structure
Success Response (200 OK):
{
  "error": false,
  "mdz_article_masters": {
    "data": [
      {
        "id": 123,
        "article_code": "ITEM001",
        "article_code_iretail": "457534523143",
        "article_description": "Product Name",
        "base_unit_of_measure": "PCS",
        "is_active": 1,
        "created_on": "2024-01-01 00:00:00",
        "created_by": 1,
        "class": {
          "id": 1,
          "name": "Class Name"
        },
        "subclass": {
          "id": 1,
          "name": "Subclass Name",
          "productClass": {
            "id": 1,
            "name": "Product Class Name"
          }
        },
        "department": {
          "id": 1,
          "name": "Department Name"
        },
        "barcodes": [
          {
            "id": 1,
            "gtin_code": "1234567890123",
            "main_ean": true
          }
        ],
        "area": {
          "id": 1,
          "code": "AREA001",
          "name": "Area Name"
        }
      }
    ],
    "current_page": 1,
    "per_page": 25,
    "total": 100,
    "last_page": 4,
    "from": 1,
    "to": 25
  }
}
Error Responses:
500 Internal Server Error:
{
  "error": true,
  "error_message": "An error occurred while fetching item master data",
  "mdz_article_masters": []
}
Response Fields
Field	Type	Description
id	integer	Unique identifier of the item
article_code	string	Article/item code
article_code_iretail	string	Article/item code iretail
article_description	string	Description of the item
base_unit_of_measure	string	Base unit of measure
is_active	integer	Active status (1 = active, 0 = inactive)
created_on	datetime	Creation timestamp
created_by	integer	ID of the creator
class	object	Class information (nullable)
subclass	object	Subclass information (nullable)
department	object	Department information (nullable)
barcodes	array	List of barcodes for the item
area	object	Area information (nullable)

Business Logic
1. Returns paginated list of item masters
2. Supports various filtering options
3. By default, only active items are returned
4. Can include current stock information when storage_location_id and show_current_stock parameters are provided
Related data (class, subclass, department, barcodes, area) are included in the response
