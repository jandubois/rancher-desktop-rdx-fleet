---
description: Learn how the content is organized in subscriptions and which content they grant access to
lang: en
robots: index, follow
title: Subscriptions \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how the content is organized in subscriptions and which content they grant access to
twitter:title: Subscriptions
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Get started](...md)
2.  Subscriptions


# Subscriptions


Learn how the content is organized in subscriptions and which content they grant access to


Application Collection uses a subscription model to deliver its content. This model has been designed based on two main ideas:

- Each application in Application Collection is labelled with a subscription.
- All subscriptions require **authentication** and **authorization**.

This means that each and every application in Application Collection requires the user to have a subscription to be able to pull it. In order to determine which subscriptions a user has, the user needs to be authenticated.

## Available subscriptions

Before digging into the details of the available subscriptions, it is important to understand that a subscription can supersede others in Application Collection.

> When a user acquires a subscription, it includes the content specific to that subscription PLUS all content included in the subscriptions that it supersedes.

At the moment, the following subscriptions are available:

|  | `Free` | `Prime` | `Extended` | `SUSE AI` |
|----|----|----|----|----|
| Available with SUSE products | \- | [SUSE Rancher Prime](https://www.suse.com/products/rancher) | [SUSE Rancher Suite](https://www.suse.com/products/rancher) & [SUSE AI Suite](https://www.suse.com/products/ai) | [SUSE AI Suite](https://www.suse.com/products/ai) |
| Content | `Free` | `Free` + `Prime` | `Free` + `Prime` + `Extended` | `Free` + `Prime` + `SUSE AI` |
| User accounts | 1 | 10 | 100 | 100 |
| User account pulls | 100 | 200 | 500 | 500 |
| Service accounts | 0 | 5 | 10 | 10 |
| Service account pulls | \- | 2000 | 5000 | 5000 |

We suggest reading how the [rate limits](get-started/rate-limits) work.

## Check subscriptions

### For an application

As mentioned before, each application in Application Collection is labelled with a subscription. This indicates the **minimum** subscription you must have in order to pull that application.

Checking the subscription of an application is easy. You just need to go to the application’s detailed page and its subscription will be shown next to the application name, in a chip format.

![Subscription of an application](images/get-started/subscriptions-application.png "Application subscription")

Due to the superseded model, an application can be pulled by a user having the subscription that is specifically required for this application or any other subscription which supersedes it. In the example above, the [Alertmanager](https://apps.rancher.io/applications/alertmanager) application is labeled with `Prime` subscription. This means that an account having `Prime` subscription will be entitled to pull it. But also a user that has paid for a `SUSE AI` subscription will have access to this application, as `SUSE AI` supersedes `Prime`.

### For a user

When checking the subscriptions of a user it is very important to understand that paid subscriptions are not directly assigned to users but to **organizations**. Hence, the subscriptions that a user has access to depends on the [authentication](get-started/authentication) method used:

- With your user account and an access token, you will have access to every paid subscription of every organization you belong to. Alternatively, you will have access to the `Free` subscription if your organizations do not grant you access to any paid subscription.
- When using a service account, you will only have access to the subscriptions of the organization that the service account belongs to.

Taking that into account, checking the subscriptions of a user is easy. You just need to follow these steps:

1.  Go to the [web application](https://apps.rancher.io) and sign in.

2.  Click on your profile picture in the upper-right corner.

3.  In the popup that appears, click on `Settings`.

4.  Your profile page will load, including a section named *Organizations*. This contains a view with all your organizations and the subscriptions assigned to each of them.

    ![Subscriptions of a user](images/get-started/subscriptions-user.png "User subscriptions")

5.  If you do not belong to any organization or none of your organizations have a paid subscription, a banner will be shown under your profile picture indicating that you only have access to the `Free` subscription.

    ![Subscriptions of a free user](images/get-started/subscriptions-free-user.png "Free user subscriptions")


Last modified July 11, 2025


