---
description: Simplify the usage of Metadata Service REST API using Postman
lang: en
robots: index, follow
title: Use REST API with Postman \| SUSE Application Collection
twitter:card: summary
twitter:description: Simplify the usage of Metadata Service REST API using Postman
twitter:title: Use REST API with Postman
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [How-to guides](...md)
2.  Use REST API with Postman


# Use REST API with Postman


Simplify the usage of Metadata Service REST API using Postman


![Postman Logo](images/howto-guides/logo-horizontal-postman.png "Postman Logo")

[Postman](https://www.postman.com/) is an API platform that makes it easier to explore, test and consume APIs. In this guide we will see how to use Postman as the API client to work with Metadata Service REST API.

## Import the API definition

To use Metadata REST API with Postman, the first thing you would need is to import the API definition. You can first download it from [Swagger UI](https://api.apps.rancher.io/swagger-ui/index.html?urls.primaryName=metadata) by clicking on the `metadata/v1/api.yml` link that appears just below the header.

Once you have downloaded the definition, follow these steps to import it into Postman.

1.  Select `Import` in the sidebar.
2.  Select the Metadata REST API definition file you have just downloaded.
3.  Select to import the definition as a *Postman Collection* and click `Import`.
4.  An *Import Complete* message will display in the footer. In the message, select the link icon to open the imported collection.

## Configure authentication

This section assumes that you already have a [user account](howto-guides/use-metadata-rest-api-with-postman/get-started/first-steps/#how-can-i-get-a-user-account) with access to Application Collection.

> If you configure authentication per-collection and let the individual requests inherit the configuration, you will avoid having to manually configure it for each request.

### Basic authentication

You can configure your Metadata Service collection to use tokens and send them through `Basic` authentication. This section assumes you already have a valid access token. If this is not the case, you can check how to get one [here](../../get-started/authentication/index.html#create-an-access-token).

Once you have a valid access token, follow these steps:

1.  Go to the `Authorization` tab of your collection and select *Basic Auth* from the `Type` drop-down list.
2.  Input your user account username in the `Username` box.
3.  Input your access token in the `Password` box.

**Make sure you save `ctrl+s`** to store the configuration. Postman will include in your requests an *Authorization header* with a Base64 encoded string representing your username and password values, appended to the text `Basic`.

## Send API request

Once you have imported the Metadata REST API definition as a collection, you will find all the requests you can do with it, organized in folders.

Sending a request is as easy as clicking on the `Send` button that you will find in the top right corner of the request. If your request needs to input any param or request body, you can do it in the corresponding tabs.

Postman will display the response data sent from the server in the lower pane.

![Postman request example](images/howto-guides/postman-request-example.png "Postman request example")


Last modified July 10, 2025


