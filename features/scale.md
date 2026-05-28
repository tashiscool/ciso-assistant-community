

# Assets

## Assets Module

This page contains information to assist our customers with utilizing the Assets module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

An asset is any tangible thing of value that might require tracking and lifecycle management.  Common types of assets include:

* Computer Hardware or Software - due to cost or sensitivity of data
* Generally anything that must be capitalized by accounting rules or is reflected on a balance sheet
* Important items of equipment that require lifecycle management

### Why would you use it?

Assets are often tracked due to the sensitivity of data in the device/application, the economic value of the item, or the need to manage its lifecycle due to compliance regulations.  There are many reasons to use our asset module which include:

* Ensure assets are properly inventoried
* Planning lifecycle management for replacements/refresh
* Driving accountability for securing data within the asset
* Collect related security data (i.e. unpatched vulnerabilities)
* Track the timeline of an asset (i.e. when it was bought, end of life date, major events, etc.)

### What are the benefits?

A strong asset management program results in multiple benefits for an organization; to include:

* Improving security; you can't secure what you don't know you have
* Avoiding technical debt through pro-active lifecycle management
* Improved accountability for the stewardship of company assets
* Improved transparency through automated dashboards

### How do I use it?

The assets module in RegScale Community Edition (CE) provides a number of key features, to include:

* Create New Assets
* Track assets (when they were purchased, end of life, etc.)
* Assign assets to security plan documentation to document the assets within the security boundary
* Track related security incidents (i.e. viruses, malware, ransonware, etc.)
* Conduct inventory processes for accountability
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs) - bring in related asset data (i.e. vulnerability data from Tenable Nessus, Wiz, and other scanners)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure related data/documentation with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see asset end of life within a given period

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different asset management programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn




# Assessments

# RegScale Manual Assessments Guide

## Overview

This guide provides a complete, step-by-step walkthrough for performing Manual Assessments in RegScale. It follows the structure and tone of the public RegScale ReadMe documentation while expanding the content to include the full SOP provided. It explains what assessments are, why they matter, and how to perform one inside a Security Plan.

## What Are Assessments?

Assessments in RegScale allow organizations to evaluate their controls for effectiveness, alignment to policy, and compliance readiness. They support continuous monitoring by enabling periodic, repeatable review cycles that result in findings, issues, and corrective action plans.

## Why Are Assessments Important?

Assessments create audit-ready documentation, ensure continuous compliance, and allow organizations to detect gaps early. They provide structure for testing, reviewing evidence, documenting results, and generating corrective actions.

# How to Perform a Manual Assessment in RegScale

## 1. Navigate to the Security Plan

1. In the top navigation bar, select **Modules**.
2. Choose **Security Plans**.
3. Locate and open the applicable Security Plan from the list.

## 2. Access the Assessment Tools

1. Inside the Security Plan, look at the right side of the screen under **Scorecard**.
2. Select **Assess Controls**.
3. At the top of the screen, select **Manual Audits**.

## 3. Create a Manual Assessment

1. Click **Create New** to begin the assessment creation wizard.
2. Complete the following steps:
   * **Title:** Enter a meaningful name.
   * **Lead Assessor:** Assign the responsible person.
   * **Instructions:** Optional details for reviewers.
   * **Schedule:** Define start and finish dates.
   * **Controls in Scope:** Select the controls being evaluated.
   * **Process Info:** Optional methodology or notes.
3. Click **Finish** to create the assessment.

## 4. Open the Assessment and Review Progress

1. Return to **Assess Controls**.
2. Under **Continuous Monitoring Assessments**, click the assessment you created.
3. On the right side, under **Data Entry**, choose **Progress Report**.
4. Scroll to the bottom to view the **Controls in Scope** list.

## 5. Launch a Lightning Assessment

1. In Controls in Scope, locate the control you want to evaluate.
2. Open the three-dot **Actions** menu.
3. Select **Lightning Assessment**.

## 6. Perform the Lightning Assessment

1. Select the **Assessment Result**: Pass, Partial Pass, Fail, or Not Applicable.
2. Document **Observations** about what was tested and what was found.
3. Add notes in **Evidence** describing or referencing the evidence used.
4. In **Gaps and Differences**, describe any issues or deficiencies found.
5. Optionally complete the **Risk** section:
   * Likelihood
   * Impact
6. Enable **Auto-generate an Issue** if you want RegScale to create a reportable item.
7. Click **Save and Next** to continue or complete the review.

## 7. Configure a Recurring Assessment

1. From within the assessment or from the Assessments module, open the **Utilities** menu.
2. Select **Recurrence Wizard**.
3. Configure the following:
   * **First Instance Planned Start** and **Finish**
   * **Repeat Until** date
   * **Assignment** (individual or group)
   * **Frequency:** Daily, Weekly, Bi-weekly, Monthly, Quarterly, Bi-annually, or Annually
4. Click **Next**, then **Confirm and Create Assessments**.
5. RegScale will generate future assessment instances automatically.



# Assessment Plans

## Assessment Plan Module

This page contains information to assist our customers with utilizing the Assessment Plan module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

An Assessment Plan is a pre-built library of questions or checks that can be used to assess compliance with a regulation or business process.  Synonyms for assessment plans include:

* Checklists
* Lines of Inquiry
* Audit Questions
* Audit Criteria
* Assessment Criteria

### Why would you use it?

Assessment plans are used to consistently conduct structured audits in a high quality manner.  It ensures that the criteria for conducting an assessment are pre-defined and repeatable.  There are many reasons to use the assessment plan module which include:

* Verify that you are meeting contractual or regulatory requirements
* Provide assurance to regulators that you are meeting your compliance obligations
* Providing a checklist-based approach to conducting an audit

### What are the benefits?

The Assessment Plan feature results in multiple benefits for an organization; to include:

* Reduced data entry by re-using audit plans
* Improved consistency in conducting audits
* Improved traceability of audit checks to requirements

### How do I use it?

The Assessment Plan module in RegScale Enterprise Edition (EE) can be used as described below:

* In the top navigation bar, select Modules, then select Assessment Plans under Regulators
* Click the "Create New" button and fill out the required fields describing the Assessment Plan and click Save
* Next, define the specific checks using the Lines of Inquiry Tab
* Each line of inquiry should have the specific question/criteria for conducting the audit and ideally a tie to the requirement in the regulation or customer business process

Once the Assessment Plan is defined, you need to load it into an assessment:

* First, open an assessment by going to Modules in the navigation bar and selecting Assessments under Workers
* To use the Assessment Plan, go to the Lines of Inquiry tab
* Select the Audit Plan you wish to use and that will load the corresponding lines of inquiry
* The top of the screen will show the progress in completing the assessment plan
* The left hand pane will show the specific lines of inquiry and let you view their status
* The right hand pane will let you assess the line of inquiry and open a new issue if there is a problem
* Continue with assessing the lines of inquiry until the assessment plan is fully complete



# Capabilities

## Capabilities Module

This page contains information to assist our customers with utilizing the Capabilities module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A business capability is a fundamental ability that an organization possesses to achieve specific outcomes and execute its business strategy. Common synonyms for capabilities might include:

* Competencies
* Functions
* Abilities

### Why would you use it?

Capabilities are managed effectively to drive strategic business outcomes. There are many reasons to perform capability management which include:

* Ensuring strategic alignment
* Optimizing resource utilization
* Enhancing risk management
* Enhancing operational efficiency
* Driving Continuous Improvement

### How do I use it?

The programs module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Managing program capabilities and objectives
* Performing complex risk modeling and assessments
* Aligning supporting technologies and platforms to capabilities
* Performing risk rollups across programs and business units
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure document management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Dashboards, Status Boards, and Score Cards to visualize progress in real-time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different project management programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn




# Case Management

## Case Management Module

This page contains information to assist our customers with utilizing the Case Management module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

Case management is a collaborative process for assessing, planning, and coordinating options for addressing any reported issues of non-compliance that may pose risk to the organization.  Common areas for case management include:

* Human Resources (HR) - Waste, Fraud, and Abuse cases, discrimination, or Equal Employment Opportunity (EEO) concerns
* Legal - investigating non-compliance with Federal, State, and Local Laws and Regulations
* Security - investigating potential Incidents of Security Concern (IOSCs)

NOTE: We are not a medical case management system or Electronic Health Records (EHR) System.

### Why would you use it?

Cases are commonly used within security, legal, or HR programs to track negative events that require an immediate response or investigation. There are many reasons to manage cases which include:

* Tracking response actions (i.e. to mitigate risks of fines or potential legal exposure)
* Categorizing and tracking/trending cases relative to severity, risk, or legal exposure
* Performing mitigation actions for any actual or expected non-compliance
* Conducting causal analysis to determine the root cause of cases
* Tracking case timelines as part of forensic analysis

### What are the benefits?

A strong case management program results in multiple benefits for an organization; to include:

* Reducing Mean Time to Respond to cases
* Leveraging trend analysis to pro-actively mitigate legal, safety, and security risks
* Reducing legal exposure from events and tracking mitigation actions to further reduce risks
* Recovering from negative events/risks related to inappropriate personnel actions
* Conducting forensic analysis to collect and turnover relevant evidence to the authorities; as applicable
* Performing corrective actions to address the root cause of a case and to prevent recurrence

### How do I use it?

The case module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Tracking reporting and response related dates for cases
* Tracking the case management phases from initial reporting to final disposition
* Conducting risk assessments related to cases
* Tracking case management tasks and collecting evidence
* Conducting causal analysis and building a forensic timeline of important events related to the case
* Assigning ownership of case management and response actions for accountability
* Real-time tracking and dashboards for visualizing progress in resolving cases
* Automation of evidence collection and forensic data via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder for forensic analysis
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to visualize incidents over time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different incident response programs with complete data isolation from a single installation (i.e. separate tenants for cyber security, physical security, and safety)
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Catalogues

## Catalog Module

This page contains information to assist our customers with utilizing the Catalog module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A catalog is a law, regulation, or other governing document that represents a collection of controls.  Catalogs are typically used to govern security and privacy programs (NOTE: they may also be used for other programs such as environment, safety, physical security, etc.) and examples include NIST 800-53, HIPAA, PCI, and GDPR.

### Why would you use it?

Catalogs are used by the builders to generate Security Plans, Components, Projects, Policies, and Supply Chain contracts (which typically consist of many security controls that impact specific asset(s) or system(s)).  There are many reasons to implement catalogs which include:

* Flowing down requirements/controls from laws, regulations, or other governing documents
* Consistently generating artifacts for System Security Plans, Components, etc.

### What are the benefits?

A catalog results in multiple benefits for an organization; to include:

* Improving quality by using a single source of truth for requirements/controls
* Reducing manual labor to handle changes to regulations
* Reducing the time needed to create artifacts by powering the RegScale builder systems

### How do I use it?

The catalog module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Tracking changes to the catalog over time and flowing down changes to related artifacts
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Audit history including every view, update, print, email, etc.



# Import Regscale Catalogs

This guide explains how to import catalogs into RegScale using two methods: Import from System and Import from File.

## Table of Contents

* [Prerequisites](#prerequisites)
* [Import from System](#import-from-system)
  * [Steps to Import a Catalog](#steps-to-import-a-catalog)
  * [Understanding the Catalog List](#understanding-the-catalog-list)
  * [Verification](#verification)
* [Import from File](#import-from-file)
  * [When to Import from File](#when-to-import-from-file)
  * [Steps to Import a Catalog from File](#steps-to-import-a-catalog-from-file)

***

## Prerequisites

* The Catalogs module must be enabled by a system administrator

<br />

***

<br />

## Import from System

RegScale ships with most catalogs already available and ready to install.

### Steps to Import a Catalog

1. **Access the Catalogs module**
   * Navigate to the Catalogs section in your RegScale instance

2. **Initiate the import process**
   * Click the **Import** button in the upper right-hand corner

3. **Select the import type**
   * Under "Select Import Type", click the **Import RegScale Catalogs** button
   * This loads a list of all available catalogs that have not been installed

### Understanding the Catalog List

When viewing available catalogs, you'll see two options for each entry:

* **Learn More** button: Opens a modal window with additional details about the catalog, including:
  * Abstract or description
  * Publication date of the original regulatory source material
* **Add** button: Installs the selected catalog to your system

### Verification

Once a catalog has been installed, it will appear in your Catalogs module view whenever you access it.

***

## Import from File

### When to Import from File

There are several scenarios where importing a catalog from file is necessary:

* **Licensed regulatory frameworks**: Some frameworks (such as ISO) have licensing restrictions and cannot be distributed through the system catalog. Contact your RegScale representative for more information on obtaining these catalogs.

* **Immediate catalog updates**: You need an urgent update to an existing catalog and cannot wait for the next application release.

* **Custom catalog migration**: You're importing a custom catalog that was exported from another RegScale installation.

### Steps to Import a Catalog from File

1. **Access the Catalogs module**
   * Navigate to the Catalogs section in your RegScale instance

2. **Initiate the import process**
   * Click the **Import** button in the upper right-hand corner

3. **Select the import type**
   * Under "Select Import Type", click the **Upload** button (this is the default option)
   * A file upload screen will appear

4. **Upload your catalog file**
   * Drag and drop a valid RegScale catalog file into the upload area, or
   * Click to open a system dialog and browse to select your file

5. **Complete the import**
   * Once the file is selected, follow the on-screen prompts to complete the import process
   * The catalog will be installed and become available in your Catalogs module



# Causal Analysis

## Causal Analysis Module

This page contains information to assist our customers with utilizing the Causal Analysis module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A causal analysis is the process of using methods and tools to establish the relationship between cause and effect.  The goal is to identify the root cause of any non-conformance or compliance deficiency so that it can be permanently eliminated through process improvement and corrective actions.  Identifying a root cause is key as this is the problem that ultimately leads to the non-conformance.  There are many proven techniques for performing causal analysis, to include:

* Event analysis
* Change analysis
* Barrier analysis
* Risk tree analysis
* Kepner-Tregoe Problem Solving and Decision Making
* Pareto analysis
* Fishbone Diagrams
* Failure Mode and Effects Analysis
* 5 Whys Analysis

### Why would you use it?

Causal analysis is often performed to prevent recurrence of any non-conformance and to drive continuous improvement.  When a major issue or non-conformance occurs, it is important to fully understand the root cause of the failure so that corrective actions have the highest probablity of being effective.  Some of the reasons to perform causal analysis are shown below:

* Drive a deeper understanding of how the problem or non-conformance occurred
* Build a more effective Corrective Action Plan (CAP)
* Prevent recurrence of significant issues
* Drive continuous improvement processes (i.e. Lean/Six Sigma)
* Develop a timeline of the failure modes to document any system breakdowns
* Trending analysis for the cause of events to identify broader systemic or cultural issues

### What are the benefits?

A strong causal analysis program results in multiple benefits for an organization; to include:

* Improve quality by eliminating the causes of non-conformances
* Lower costs by reducing the number of defects
* Improve compliance by eliminating the cause of issues and prevent recurrence
* Reduce risk by avoiding future problems
* Improve transparency through automated dashboards

### How do I use it?

The causal analysis module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Linking causal analysis efforts to assessments/issues
* Tracking progress against completing causal analysis (due dates, # overdue, etc.)
* Documenting and assigning corrective actions
* Real-time tracking and dashboards
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see causal analysis efforts due within any given period

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different causal analysis programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn
* Facility specific views of causal analysis due dates with Geographic Information System (GIS) overlays



# Changes

This page contains information to assist our customers with utilizing the Change Management module in RegScale. It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

**What is it?**

ITIL (Information Technology Infrastructure Library) Change Management is a process framework for managing changes to IT systems and services in a controlled and structured way. The ITIL framework is widely adopted by organizations around the world to manage IT service delivery and is a set of best practices for IT service management.

Change management is a key process within ITIL, which aims to minimize the risk of disruptions to IT services caused by changes to IT systems and infrastructure. The goal of change management is to ensure that changes are made in a controlled and systematic way that minimizes disruption to IT services while maximizing the benefits of the changes.

The ITIL change management process typically involves the following steps:

* Request for Change (RFC): A request for change is submitted to the change management team to request a change to a system or service. The RFC includes details of the proposed change, the reason for the change, and the expected benefits.
* Change Assessment: The change management team assesses the RFC to determine the potential impact of the change on IT services, including the risks, costs, and benefits.
* Change Approval: The change management team evaluates the change assessment and decides whether to approve or reject the change request. If the change is approved, the change management team will develop a change plan.
* Change Implementation: The change management team implements the change according to the change plan, which includes testing, training, and communication with stakeholders.
* Change Review: After the change has been implemented, the change management team reviews the change to ensure that it has been successful and meets the expected outcomes.
* Change Closure: Once the change has been reviewed and approved, the change management team closes the change request.

Overall, ITIL change management is an important process for organizations to ensure that changes to IT systems and infrastructure are made in a controlled and systematic way, reducing the risk of disruption to IT services while maximizing the benefits of the changes.

**Why would you use it?**

Change management is an essential process for any organization that relies on IT systems and services. Here are some of the key reasons why an organization might use change management:

* Minimize disruptions to IT services: Change management helps to minimize the risk of disruptions to IT services caused by changes to IT systems and infrastructure. By following a structured and controlled process for making changes, organizations can reduce the likelihood of unintended consequences or unforeseen issues that could disrupt IT services.
* Ensure compliance: Change management helps organizations to ensure compliance with industry standards and regulations, such as ITIL, PCI-DSS, and HIPAA. By following a structured process for making changes, organizations can ensure that they are meeting the necessary compliance requirements.
* Improve efficiency: Change management can help organizations to improve the efficiency of their IT operations by reducing the time and effort required to manage changes. By having a centralized process for managing changes, organizations can streamline the change management process and reduce the administrative burden on IT teams.
* Enhance communication and collaboration: Change management encourages communication and collaboration between IT teams and other stakeholders, such as business units and customers. By involving stakeholders in the change management process, organizations can ensure that changes are aligned with business goals and priorities, and that any potential issues are identified and addressed early on.
* Maximize benefits: Change management helps organizations to maximize the benefits of changes to IT systems and infrastructure by ensuring that changes are made in a controlled and systematic way. By carefully planning and executing changes, organizations can minimize the risk of disruption to IT services and ensure that changes are delivering the expected benefits.

Overall, change management is essential for organizations that rely on IT systems and services to operate. By following a structured and controlled process for making changes, organizations can reduce the risk of disruptions to IT services, ensure compliance with industry standards and regulations, improve efficiency, enhance communication and collaboration, and maximize the benefits of changes.

**What are the benefits?**

There are several direct benefits of change management that organizations can realize:

* Reduced risk of service disruptions: By following a structured change management process, organizations can minimize the risk of service disruptions caused by changes to IT systems and infrastructure. The change management process helps to identify potential risks and issues before changes are made, and ensures that changes are tested and implemented in a controlled and systematic way.
* Faster resolution of incidents: When incidents do occur, change management can help organizations to respond more quickly and effectively. By having a clear understanding of the IT environment and the changes that have been made, IT teams can more quickly diagnose and resolve incidents, minimizing the impact on business operations.
* Improved compliance: Change management is often required to comply with industry standards and regulations such as ITIL, HIPAA, and PCI-DSS. By following a structured and auditable process for making changes, organizations can demonstrate compliance with these standards and avoid costly penalties for non-compliance.
* Increased efficiency: Change management can help organizations to increase efficiency by streamlining the change process and reducing the administrative burden on IT teams. By automating some aspects of the change management process, such as change approvals and notifications, organizations can reduce the time and effort required to manage changes.
* Better alignment with business goals: By involving stakeholders in the change management process, organizations can ensure that changes are aligned with business goals and priorities. By carefully planning and executing changes, organizations can ensure that changes are delivering the expected benefits and are not causing unintended consequences.

Overall, the direct benefits of change management include reduced risk of service disruptions, faster incident resolution, improved compliance, increased efficiency, and better alignment with business goals. By implementing a structured change management process, organizations can realize these benefits and ensure that changes are made in a controlled and systematic way.

**How do I use it?**\
The case module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

Tracking and reporting the status of changes

* Conducting risk assessments related to changes
* Tracking change management tasks and collecting evidence
* Assigning ownership of change management and response actions for accountability
* Real-time tracking and dashboards for visualizing progress in resolving changes
* Automation of evidence collection and forensic data via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder for forensic analysis
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different - - incident response programs with complete data isolation from a single installation (i.e. separate tenants for cyber security, physical security, and safety)
* Real-time interactive dashboard with Microsoft PowerBI AddOn

**How can I customize this?**

Using Setup -> Metadata, you can add additional options to the Change Type Drop Down and Priority options in the Change Module.  Please visit our page on [Metadata](https://regscale.readme.io/docs/metadata-1) for more information.



# Components

## Components Module

This page contains information to assist our customers with utilizing the Components module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

The OSCAL component definition model represents a description of the controls that are supported in a given implementation of a hardware, software, service, policy, process, procedure, or compliance artifact.  The component definition model allows grouping related components into capabilities, and documenting how the combination of components in a capability together can satisfy specific controls that are not fully satisfied by a single component on its own.  Learn more on the [NIST OSCAL Components Website](https://pages.nist.gov/OSCAL/concepts/layer/implementation/component-definition/).

### Why would you use it?

These component definitions can be used by organizations implementing the thing defined by a given component to provide a significant amount of implementation details needed when documenting a system's control implementation in a system security plan. This information can be used by the system security plan author as a starting point for their work, saving time and cost. There are many reasons to document components which include:

* Accelerate implementation by leveraging vendor provided component implementations
* Bite off one piece at a time for documentation to make implemenation more manageable
* Save money by reducing duplication of effort and layering in controls for components
* Ability to focus effort by Subject Matter Expert (SME) for each component to improve granularity versus a ISSO/generalist approach to a broad boundary

### What are the benefits?

The component module results in multiple benefits for an organization; to include:

* Fuller understanding of each information system's security implementation
* Verification of compliance with regulations to reduce fines and audit risks
* Validation of control implementations to reduce risk
* Strong accountability for risk acceptance for senior organization officials
* Delegation of common control implementations to vendor's who adopt the OSCAL standard over time
* Leveraging consistent vendor best practices for a given component

### How do I use it?

The component module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Tracking metadata for components that roll up to a broader System Security Plan (SSP)
* Tracking expiration dates for component security authorizations and the dates controls were last assessed/tested
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs) - scripting evidence collection and documentation gathering
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see data calls scheduled within any given period
* Dashboards, Status Boards, and Score Cards to visualize progress in real-time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Data Calls

## Data Calls Module

This page contains information to assist our customers with utilizing the Data Calls module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A data call is the process of requesting specific information in support of a compliance assessment or other related compliance matter.  Common synonyms for data calls might include:

* Request for Information
* Discovery
* Pre-Read Information
* Evidence Collection

### Why would you use it?

Data calls are commonly used to collect documentation and evidence in advance of assessment activities.  Effective data calls ensure that auditors have sufficient information for pre-reads and audit preparation prior to commencing formal field work and verification activities. There are many reasons to perform data calls which include:

* Tracking the status of evidence collection before an audit commences
* Collecting documentation to help build an assessment plan
* Maintaining an audit history of who provided the files to which interested parties
* Ensuring that dates are tracked for delivery of required documentation
* Managing recurring data calls from regulators and external parties

### What are the benefits?

A strong data call program results in multiple benefits for an organization; to include:

* Improved accountability for providing timely responses
* Ability to track what was provided to who and when
* Improved evidence storage and security
* Ability to develop better assessment plans based on knowledge gained from data calls
* Never lose track of routine deliverables by scheduling recurring data calls
* Improved transparency through automated dashboards

### How do I use it?

The data call module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Scheduling data calls (when they are due, responsible person, date requested, site/facility, etc.)
* Tracking progress against due dates (% complete, % delivered on-time, etc.)
* Tracking related tasks and evidence
* Scheduling recurring data calls (should happen every week, month, quarter, etc.)
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs) - scripting evidence collection and documentation gathering
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see data calls scheduled within any given period

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different data call programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Evidence Locker

## Evidence Locker Module

This page contains information to assist our customers with utilizing the Evidence Locker module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

An Evidence Locker is a central repository for storing audit support evidence that can be mapped and re-used across multiple systems and controls.

### Why would you use it?

Evidence locker is commonly used to streamline evidence gathering for large organizations that need to attest to the compliance of multiple systems.  It provides an easy mapping wizard to align a single piece of evidence to all of the controls across all of the systems that it may satisfy.  There are many reasons to use evidence locker which include:

* Verify that you are meeting contractual or regulatory requirements
* Provide assurance to regulators that you are meeting your compliance obligations
* Attesting to evidence for shared services that cross multiple systems
* Streamlining evidence collection for complex organizations
* Ensuring timeliness requirements for evidence updates are met

### What are the benefits?

The evidence locker feature results in multiple benefits for an organization; to include:

* Reduced data entry and evidence collection
* Improves the cost effectiveness of leveraging shared services
* Ensures timely update to support audit readiness

### How do I use it?

The Evidence Locker in RegScale Enterprise Edition (EE) can be used as described below:

* In the top navigation bar, select Modules, then select Evidence Locker under Organizers
* Click the "Create New" button and fill out the required fields describing the piece of evidence and click Save
* Next, upload the evidence files using the File Upload tab
* Next, select the component or security plan that leverages this evidence, then tag the controls that the evidence satisfies
* NOTE: If there are many instances of a given control across systems, it will show them all so that you can tag them to the evidence as appropriate.
* To view all controls mapped to the piece of evidence, use the Control Implementations tab.

### How It Works?

* You can create a new piece of evidence and assign an owner and frequency you would like it updated (i.e. every 90 days)
* You then upload files as evidence which auto-sets the next due date based on the update frequency
* You can then use the Evidence Workspace or Evidence Reports to view overall status, email evidence owners to provide updates, and manage evidence across its lifecycle



# Exceptions

## Exceptions Module

This page contains information to assist our customers with utilizing the Exceptions module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A exception is the process of providing temporary relief for a non-compliant requirement or control.

### Why would you use it?

Exceptions are commonly used to justify the basis for non-compliance with organizational policy. There are many reasons to manage exceptions which include:

* Document the justification for the exception to include things such as:
  * Technical feasibility
  * Cost feasibility
  * Risk assessment
  * Compensatory controls and mitigations
* Provide workflows for review and approval
* Provide lifecycle management for exception expiration dates

### What are the benefits?

A strong exception management program results in multiple benefits for an organization; to include:

* Document the justification for the exception for defending to auditors
* Improve accountability for approving policy exceptions
* Avoid expired exceptions that may result in audit findings and non-compliances
* Reduce risks associated with non-compliances

### How do I use it?

The exception module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Tracking approval and expiration dates for lifecycle management
* Tracking the status of exceptions (i.e. Approved, Draft, Pending Approval, Expired, etc.)
* Conducting risk assessments related to exceptions
* Tracking related tasks and evidence
* Assigning ownership of policy/control/requirement exceptions
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see exceptions expiring within any given period

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different exception management programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Incidents

## Incidents Module

This page contains information to assist our customers with utilizing the Incidents module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

An incident is a negative event which could jeopardize the safety or security of a customer's information, people, or assets.  Incident Response is the process of performing triage actions to mitigate the immediate damage of an event, discover its cause, and to recover from the event.

### Why would you use it?

Incidents are commonly used within cyber security, physical security, or safety programs to track negative events that require an immediate response. There are many reasons to manage incidents which include:

* Tracking incident response actions (i.e. as part of a Security Operations Center (SOC))
* Categorizing and tracking/trending incidents relative to severity
* Performing mitigation actions and restoring operations
* Tracking incident timelines as part of forensic analysis
* Conducting causal analysis to indentify the root cause of an incident

### What are the benefits?

A strong incident response program results in multiple benefits for an organization; to include:

* Reducing Mean Time to Respond to incidents
* Leveraging trend analysis to pro-actively mitigate future events
* Reducing down time from events and track mitigation actions
* Recovering from negative consequences such as cyber attacks, insider threat, safety issues, and other incidents
* Conducting forensic analysis to collect and turnover relevant evidence to the authorities; as applicable
* Performing corrective actions to address the root cause of an incident and to prevent recurrence

### How do I use it?

The incident module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Tracking detection and response related dates for incidents
* Tracking the incident response phases
* Conducting risk assessments related to incidents
* Tracking incident response tasks and collecting evidence
* Conducting causal analysis and building a forensic timeline of important events related to the incident
* Assigning ownership of incident and response actions for accountability
* Real-time tracking and dashboards
* Automation of evidence collection and forensic data via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder for forensic analysis
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to visualize incidents over time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different incident response programs with complete data isolation from a single installation (i.e. separate tenants for cyber security, physical security, and safety)
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Interconnections

## Interconnections Module

This page contains information to assist our customers with utilizing the Interconnections module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A interconnect is the process of connecting two systems for the purpose of data exchange.  Common synonyms for interconnections might include:

* APIs
* Web Services
* FTP/Batch Processing

### Why would you use it?

Interconnections are commonly used to document and approve the process of exchanging data across system boundaries.  Interconnections ensure you know where your data is going, who is responsible for it, and who approved the exchange. There are many reasons to manage interconnections which include:

* Understanding where your data is going
* Understanding the impacts of downtime on interconnected systems
* Obtaining formal approvals of all data exchanges
* Maintaining the lifecycle of interconnects over time

### What are the benefits?

A strong interconnect management program results in multiple benefits for an organization; to include:

* Reduced risk of data loss
* Reduced risk of cascading downtime and unexpected problems for system outages
* Increased accountability for where company data is stored, processed, or transmitted
* Minimized access to data based on least privilege and need to know

### How do I use it?

The Interconnections module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Tracking approval and expiration dates for interconnections
* Relating interconnects to specific system boundaries
* Tracking related tasks and evidence
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure document management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see interconnects expiring over time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different interconnection programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Interconnections

## Interconnections Module

This page contains information to assist our customers with utilizing the Interconnections module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A interconnect is the process of connecting two systems for the purpose of data exchange.  Common synonyms for interconnections might include:

* APIs
* Web Services
* FTP/Batch Processing

### Why would you use it?

Interconnections are commonly used to document and approve the process of exchanging data across system boundaries.  Interconnections ensure you know where your data is going, who is responsible for it, and who approved the exchange. There are many reasons to manage interconnections which include:

* Understanding where your data is going
* Understanding the impacts of downtime on interconnected systems
* Obtaining formal approvals of all data exchanges
* Maintaining the lifecycle of interconnects over time

### What are the benefits?

A strong interconnect management program results in multiple benefits for an organization; to include:

* Reduced risk of data loss
* Reduced risk of cascading downtime and unexpected problems for system outages
* Increased accountability for where company data is stored, processed, or transmitted
* Minimized access to data based on least privilege and need to know

### How do I use it?

The Interconnections module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Tracking approval and expiration dates for interconnections
* Relating interconnects to specific system boundaries
* Tracking related tasks and evidence
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure document management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see interconnects expiring over time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different interconnection programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Policies

## Policies Module

This page contains information to assist our customers with utilizing the Policy module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A policy is a set of rules, principles, and guidelines that govern operations for a given organization.  Common synonyms for policies might include:

* Laws
* Regulations
* Standards
* Procedures
* Protocols

### Why would you use it?

Policies are used to govern how activities must be conducted in a repeatable and enforceable manner.  Effective policy management ensures that all employees know what to do when and that the organization can improve the repeatability of key processes that may be subject to broader laws or regulations. There are many reasons to perform policy management which include:

* Tracking the lifecycle of policies (date approved, date of last review, expiration date)
* Tracking the implementation of policy requirements
* Identifying non-compliances with policy
* Flowing down policy requirements to vendors and 3rd parties
* Ensuring compliance with applicable laws and regulations

### What are the benefits?

A strong policy program results in multiple benefits for an organization; to include:

* Ensuring periodic reviews to keep policies up to date
* Ensuring compliance with requirements to avoid non-compliances, fines, and audit risks
* Improving the repeatability of important processes; especially as they relate to laws and regulations
* Driving continuous improvement
* Reducing third party risk for vendors and subcontractors
* Avoiding fines, loss of contracts, and brand reputation damage

### How do I use it?

The policy module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Flowing down requirements to third party vendors and subcontractors
* Tracking expirations dates and periodic policy reviews
* Scheduling assessments against discrete policy requirement(s)
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure document and version management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see policies expiring within any given period
* Dashboards, Status Boards, and Score Cards to visualize progress in real-time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different policy management programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Programs

## Programs Module

This page contains information to assist our customers with utilizing the Programs module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A program is a coordinated set of activities or projects aimed at achieving strategic objectives and delivering value to stakeholders. Common synonyms for programs might include:

* Mission Areas
* Business Units
* Initiatives

### Why would you use it?

Programs are commonly used to coordinate collections of projects/activities and for risk modeling. There are many reasons to perform program management which include:

* Ensuring strategic alignment
* Optimizing resource utilization
* Enhancing risk management
* Improving stakeholder satisfaction
* Achieving business outcomes

### How do I use it?

The programs module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Managing program capabilities and objectives
* Performing complex risk modeling and assessments
* Aligning supporting technologies and platforms to capabilities
* Performing risk rollups across programs and business units
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure document management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Dashboards, Status Boards, and Score Cards to visualize progress in real-time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different project management programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Projects

## Projects Module

This page contains information to assist our customers with utilizing the Projects module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A project is a discrete set of scope (requirements) that must be accomplished within a fixed budget and/or schedule.  Projects can be executed using a variety of methodologies including Waterfall and Agile.  Common synonyms for projects might include:

* Initiatives
* Programs (potentially collections of projects)

### Why would you use it?

Projects are commonly used to manage important organization initiatives.  Projects always manage the triple contstraints of scope, cost, and schedule while ensuring quality for deliverables. There are many reasons to perform project management which include:

* Tracking delivery of organization initiatives
* Assigning ownership of deliverables
* Ensuring requirements are delivered
* Ensuring costs are controlled
* Ensuring scheduled delivery dates are met
* Managing the overall portfolio of program investments against the organization's goals and strategy

### What are the benefits?

A strong project management program results in multiple benefits for an organization; to include:

* Improving delivery on company initiatives
* Driving accountability for results
* Verifying compliance with overall project requirements
* Reducing overall costs
* Improving on-time delivery
* Balancing investments across the overall portfolio needs for the business

### How do I use it?

The projects module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Managing project milestones
* Tracking project expenses against overall budget
* Tracking implementation of project requirements
* Tracking progress against due dates (% complete, % delivered on-time, etc.)
* Tracking overall project drivers (i.e. mandates, audit findings, strategic drivers, cost savings, risk reduction, revenue generation, etc.)
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure document management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see project deliverables due within any given period
* Dashboards, Status Boards, and Score Cards to visualize progress in real-time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different project management programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Questionnaires

## Questionnaire Module

This page contains information to assist our customers with utilizing the Questionnaire module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

Questionnaires are a mechanism for collection structured data via questions that help with evaluating or assessing compliance or risk.

### Why would you use it?

Questionnaires are commonly used to support risk and compliance programs. There are many reasons to use questionnaires which include:

* Providing for attestation of compliance with a set of requirements/controls
* Collecting risk data from vendors, partners, and other stakeholders
* Supporting data calls for audits and assessments

### What are the benefits?

A questionnaire system results in multiple benefits for an organization; to include:

* Reducing labor costs to collect audit support information
* Collecting attestation information from vendors and support contractors
* Reducing risk by collecting timely and accurate information to make decisions

### How do I use it?

The questionnaire module in RegScale Enterprise Edition (EE) provides a number of key features that are useful in managing a robust program, to include:

* Dynamic form builder to select different question types and order then in the UI
* Tools for assigning and tracking questionnaires
* Tracking the questionnaire through its lifecycle from assignment, to completing, to reviewing
* Relating questionnaires to contracts, audits, and risks assessments
* Gathering information from vendors and staff tasks and collecting evidence
* Assigning ownership of the questionnaire and response actions for accountability
* Supporting file uploads
* Rules for dynamic, interactive questionnaires
* Exporting responses in spreadsheet



# Questionnaires

## Questionnaire Module

This page contains information to assist our customers with utilizing the Questionnaire module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

Questionnaires are a mechanism for collection structured data via questions that help with evaluating or assessing compliance or risk.

### Why would you use it?

Questionnaires are commonly used to support risk and compliance programs. There are many reasons to use questionnaires which include:

* Providing for attestation of compliance with a set of requirements/controls
* Collecting risk data from vendors, partners, and other stakeholders
* Supporting data calls for audits and assessments

### What are the benefits?

A questionnaire system results in multiple benefits for an organization; to include:

* Reducing labor costs to collect audit support information
* Collecting attestation information from vendors and support contractors
* Reducing risk by collecting timely and accurate information to make decisions

### How do I use it?

The questionnaire module in RegScale Enterprise Edition (EE) provides a number of key features that are useful in managing a robust program, to include:

* Dynamic form builder to select different question types and order then in the UI
* Tools for assigning and tracking questionnaires
* Tracking the questionnaire through its lifecycle from assignment, to completing, to reviewing
* Relating questionnaires to contracts, audits, and risks assessments
* Gathering information from vendors and staff tasks and collecting evidence
* Assigning ownership of the questionnaire and response actions for accountability
* Supporting file uploads
* Rules for dynamic, interactive questionnaires
* Exporting responses in spreadsheet



# Requirements

## Requirements Module

This page contains information to assist our customers with utilizing the Requirements module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A requirement is a need or want that may be associated with a project, policy, or other object in RegScale.  Common synonyms for requirements might include:

* Needs
* Wants
* Scope

### Why would you use it?

Requirements are commmonly used to collect the mandatory needs of a given organization.  Requirements may be associated with policies, projects, or other broader initiatives. There are many reasons to manage requirements which include:

* Ensuring compliance with a given set of requirements
* Tracking the implementation status of requirements
* Flowing down requirements to vendors and 3rd parties
* Ensuring compliance with applicable laws and regulations

### What are the benefits?

A strong requirements program results in multiple benefits for an organization; to include:

* Ensuring periodic reviews to keep requirement implementations up to date
* Ensuring compliance with requirements to avoid non-compliances, fines, and audit risks
* Ensuring the implementation of important requirements; especially as they relate to laws and regulations
* Driving continuous improvement
* Reducing third party risk for vendors and subcontractors
* Avoiding fines, loss of contracts, and brand reputation damage

### How do I use it?

The requirements module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Flowing down requirements to third party vendors and subcontractors
* Tracking requirement implementation status
* Scheduling assessments against discrete requirement(s)
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different requirement programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Risks

## Risks Module

This page contains information to assist our customers with utilizing the Risk module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A risk is a situation that could expose an organization to loss, danger, or some negative consequence.  Risk are normally analyzed in terms of probability and consequence.  Common synonyms for risks might include:

* Dangers
* Probability
* Peril
* Hazards

### Why would you use it?

Risk management is used to evaluate potential negative events, in terms of probability and consequence, to cost effectively mitigate the risk.  Effective risk management allows organizations to pro-actively prevent negative events and make better informated budgeting decisions. There are many reasons to perform risk management which include:

* Analyzing probability and consequence for negative events
* Tracking mitigation actions
* Determining the triggers that could realize the risk
* Ensuring that risks are reviewed and approved by organizational decision makers
* Factoring risk into various decisions around project management, exceptions, security control implementations, etc.
* Performing risk assessments for new threats

### What are the benefits?

A strong risk management program results in multiple benefits for an organization; to include:

* Understanding the overall risk to the organization for improved situational awareness
* Pro-actively reducing risk by applying mitigations
* Avoiding trigger events to keep risks from being realized
* Improving accountability for accepting risk
* Achieving an integrated view of risk across various data silos
* Evergreening risk assessments over time as threats change

### How do I use it?

The risk management module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Tracking the status of risks over their lifecycle
* Analyzing risk and applying mitigations
* Tracking related mitigation actions and evidence
* Establishing risk mitigation strategies (i.e. accept, avoid, mitigate)
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and acceptance of risks
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure document management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different risk management programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn

### Risk Lenses

RegScale (as of version 3.3.0) now supports risk lens analysis to categorize risk based on their impacts across multiple areas:

* Business Risk
* Operational Risk
* Safety Risk
* Security Risk
* Quality Risk
* Environmental/Sustainability Risk
* Reputation Risk
* Compliance/Regulatory Risk

By viewing risk through multiple lenses, RegScale can now model impacts to risk beyond basic probability and consequence where discrete impacts across multiple areas can be considered as part of a comprehensive risk management program.

### Risk Trending

As of version 3.3.0, RegScale allows trending risks over time versus the previous snapshot in time approach.  This capability allows customers to create trend entries on a periodic basis (i.e. monthly, quarterly, etc.) to model changes in risk and their potential impacts to the company or a project's cost and schedule.



# Security Controls

## Security Control Implementation Module

This page contains information to assist our customers with utilizing the Security Control Implementations module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A security control is a safeguard or countermeasure to avoid, detect, counteract, or minimize security risks to physical property, information, computer systems, or other assets.  Control implementations are specific policies, tools, and techniques that are used to satisfy the security control requirements.  Common synonyms for security controls might include:

* Requirements
* Control Implementations
* Security Checks

### Why would you use it?

Security control implementations are used to build Security Plans (which typically consist of many security controls that impact specific asset(s) or system(s)).  These security plans are typically built to satisfy compliance requirements such as NIST 800-53, ISO 27001, HIPAA, or PCI DSS. There are many reasons to implement security controls which include:

* Conducting automated assessments
* Tracking the date a control was last assessed/tested
* Updating security plans
* Verifying compliance with regulations
* Documenting organization policies and implementations
* Collecting audit/testing evidence

### What are the benefits?

A strong security control implementation program results in multiple benefits for an organization; to include:

* Reducing costs and improving situational awareness by automating compliance checks
* Avoid audit findings by continuously monitoring the status of security controls
* Evergreen security plan documentation and keep everything up to date without manual labor
* Ensure you controls are fully compliant with applicable laws and regulations
* Improve accountability and repeatability by documenting security policies and associated implementations
* Securely store testing evidence using our AES-256 encrypted evidence locker

### How do I use it?

The security control implementation module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Tracking the date last assessed/tested for each security control
* Tracking process and practice maturity as defined by the Cyber Maturity Model Certification (CMMC)
* Defining policy and implementation details for each security control
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different security control implementations with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Security Plans

## Security Plans Module

This page contains information to assist our customers with utilizing the Security Plans module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A security plan is a document that describes all relevant security controls, their implementations, and related data for a given boundary (a logical collection of components or assets).  Common synonyms for security plans might include:

* System Security Plan (SSP)
* Information System Security Plan (ISSP)

### Why would you use it?

Security plans are commonly used to document the implementation of security controls (i.e. regulatory requirements) for a given information system.  Security plans are required for a variety of common regulations to include NIST 800-53, PCI, HIPAA, ISO 27001, Cloud Security Alliance (CSA), and others. There are many reasons to document security plans which include:

* Tracking information about the security of the information system
* Thoroughly describing security policies and implementation controls against the regulations
* Conducing audits and testing to verify compliance for control implementations
* Tracking review and approval cycles to accept risk

### What are the benefits?

A strong security plan program results in multiple benefits for an organization; to include:

* Fuller understanding of each information system's security implementation
* Verification of compliance with regulations to reduce fines and audit risks
* Validation of control implementations to reduce risk
* Strong accountability for risk acceptance for senior organization officials

### How do I use it?

The security plan module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Tracking metadata for security plans and categorizing systems
* Tracking expiration dates for security authorizations and the dates controls were last assessed/tested
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs) - scripting evidence collection and documentation gathering
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see data calls scheduled within any given period
* Dashboards, Status Boards, and Score Cards to visualize progress in real-time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different security plan programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Security Plans

## Security Plans Module

This page contains information to assist our customers with utilizing the Security Plans module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A security plan is a document that describes all relevant security controls, their implementations, and related data for a given boundary (a logical collection of components or assets).  Common synonyms for security plans might include:

* System Security Plan (SSP)
* Information System Security Plan (ISSP)

### Why would you use it?

Security plans are commonly used to document the implementation of security controls (i.e. regulatory requirements) for a given information system.  Security plans are required for a variety of common regulations to include NIST 800-53, PCI, HIPAA, ISO 27001, Cloud Security Alliance (CSA), and others. There are many reasons to document security plans which include:

* Tracking information about the security of the information system
* Thoroughly describing security policies and implementation controls against the regulations
* Conducing audits and testing to verify compliance for control implementations
* Tracking review and approval cycles to accept risk

### What are the benefits?

A strong security plan program results in multiple benefits for an organization; to include:

* Fuller understanding of each information system's security implementation
* Verification of compliance with regulations to reduce fines and audit risks
* Validation of control implementations to reduce risk
* Strong accountability for risk acceptance for senior organization officials

### How do I use it?

The security plan module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Tracking metadata for security plans and categorizing systems
* Tracking expiration dates for security authorizations and the dates controls were last assessed/tested
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs) - scripting evidence collection and documentation gathering
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see data calls scheduled within any given period
* Dashboards, Status Boards, and Score Cards to visualize progress in real-time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different security plan programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Supply Chain

## Supply Chain Module

This page contains information to assist our customers with utilizing the Supply Chain module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A supply chain is the set of vendors and subcontractors that provide goods and services that support an organization.  Common synonyms for supply chain might include:

* Subcontractors
* Vendor Management
* 3rd Party Risk
* Contracts

### Why would you use it?

The supply chain module is typically used to manage 3rd party risk for vendors and subcontracts.  There are many reasons to manage the supply chain which include:

* Managing contracts (whether your contracts or subcontractors for your organization)
* Flowing down requirements to 3rd party vendors
* Assessing compliance of vendors with requirements
* Conducting vendor risk assessments
* Reviewing and approving contract related tasks

### What are the benefits?

A strong supply chain program results in multiple benefits for an organization; to include:

* Providing oversight of the full portfolio of contracts
* Ensuring compliance with requirements for 3rd party vendors
* Reducing risk by scheduling assessments/audits and tracking non-compliances
* Providing active mitigations against third party risk while factoring risk into future vendor contracts
* Improving accountability for contract actions with digital workflow tools

### How do I use it?

The supply chain module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Manage contract schedules (when they start, when they end, when they renew, etc.)
* Conduct vendor risk assessments
* Flow down policy/compliance requirements to vendor contracts
* Conduct assessments for vendor compliance with flow down requirements
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure vendor documentation management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see supply chain related events scheduled within any given period
* Dashboards, Status Boards, and Score Cards to visualize progress in real-time

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different supply chain programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Tasks

## Tasks Module

This page contains information to assist our customers with utilizing the Task module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A task is a discrete action that should be accomplished by a person by a given due date.  Common synonyms for tasks might include:

* Actions
* Assignments
* Corrective Actions

### Why would you use it?

Tasks are commonly used to drive accountability for completing work.  Tasks can be assigned to all modules in RegScale and also assigned as stand alone actions. There are many reasons to track tasks which include:

* Ensuring follow through on corrective actions
* Tracking due dates
* Assigning responsibility
* Tracking percent complete

### What are the benefits?

A strong task management program results in multiple benefits for an organization; to include:

* Preventing recurrence of issues
* Improving timeliness of delivery
* Ensuring accountability for completing work
* Real-time view into progress

### How do I use it?

The task module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Assigning work and corrective actions
* Tracking progress against due dates (% complete, % delivered on-time, etc.)
* Scheduling recurring tasks (should happen every week, month, quarter, etc.)
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.
* Calendar view to see tasks due within any given period

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different task management programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn



# Threats

## Threats Module

This page contains information to assist our customers with utilizing the Threat module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A threat is a person or thing that is likely to cause damage or danger.  Common synonyms for threats might include:

* Warnings
* Hazards

### Why would you use it?

Threats are commonly combined with potential vulnerabilities to create risks to an organization.  New threats should be properly analyzed to protect the organization's interest over time as the threat landscape changes. There are many reasons to track threats which include:

* Updating risks analysis/assessments
* Identifying and then eliminating vulnerabilities
* Applying mitigations

### What are the benefits?

A strong threat management program results in multiple benefits for an organization; to include:

* Improving resilience over time
* Pro-active risk mitigation
* Potential cost avoidance

### How do I use it?

The threat module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Conducting triage actions to apply mitigations
* Analyzing the environment for vulnerabilities that can be exploited
* Conducting risk assessments
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different threat management programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn

# Threats

## Threats Module

This page contains information to assist our customers with utilizing the Threat module in RegScale.  It describes what it is, why you would use it, the benefits, and provides instructions on getting started.

### What is it?

A threat is a person or thing that is likely to cause damage or danger.  Common synonyms for threats might include:

* Warnings
* Hazards

### Why would you use it?

Threats are commonly combined with potential vulnerabilities to create risks to an organization.  New threats should be properly analyzed to protect the organization's interest over time as the threat landscape changes. There are many reasons to track threats which include:

* Updating risks analysis/assessments
* Identifying and then eliminating vulnerabilities
* Applying mitigations

### What are the benefits?

A strong threat management program results in multiple benefits for an organization; to include:

* Improving resilience over time
* Pro-active risk mitigation
* Potential cost avoidance

### How do I use it?

The threat module in RegScale Community Edition (CE) provides a number of key features that are useful in managing a robust program, to include:

* Conducting triage actions to apply mitigations
* Analyzing the environment for vulnerabilities that can be exploited
* Conducting risk assessments
* Real-time tracking and dashboards
* Automation via our Application Programming Interfaces (APIs)
* Single pane of glass assignment tracking via our work bench
* Automated workflows for review and approval
* Interactive timeline builder
* Social collaboration via our News Feed (LinkedIn for Compliance) and real-time commenting system
* Secure evidence management with our file upload and encryption system
* Audit history including every view, update, print, email, etc.

For our Enterprise Edition (EE) customers, you get all the great features above, plus we add:

* Ability to create custom fields to extend the schema and build out customer specific data entry forms
* Integration with Microsoft Teams and Slack for real-time collaboration
* Ability to host a multi-tenant version to segregate data by site, customer, organization, etc. to run many different threat management programs with complete data isolation from a single installation
* Real-time interactive dashboard with Microsoft PowerBI AddOn
