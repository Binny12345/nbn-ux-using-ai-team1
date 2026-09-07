# Environments

Through the course of this project, we will emulate a real industry-style environment. All new features developed will be created in separate sub-branches, with a PR Made to push the changes to main/production.

### Main / Production
The Main branch will be used as the production branch, where every accepted PR towards Main will auto deploy via Vercel. 

Due to the sensitivity of the Main branch, by no means is a push directly to main allowed, as this will have your changes be pushed to the deployed application. 

Instead, you must ensure that all code has first been tested to ensure that funcitonality remains and bugs aren't present. Then once that is complete, then a PR can be made, whih at that point the PM will then accept such changes towards main.

### Naming conventions
All branches are to be named by adding the main keyword before the specific task you are working on, such as "Feature/..." or "Fix/..."

Example would be 
- "Feature/Login-styling"
- "Fix/auth-routing"
- "Docs/Documentation-Update"

# Deployment

Deployment will be mainly handled via Vercel, a cloud platform that allows free deployments of applications instantly. How this will work will be documented below:

### Pipeline
- A PR is created by one of the developers to push their latest changes to Main. 
- The PR will have to be accepted by the PM.
- Once the PR is accepted and moved to main, the changes will automatically be deployed to Vercel. This is done by hooking up the main branch as the main source  for the application.
- Changes will then be live and accessible via the provided URL, or a custom URL set by the Dev's

### Risks to be assessed
- Push directly to main: This is most likely the biggest risk in terms of deployment and environment.Pushing directly towards the main branch would most likely cause bugs to appear in the final deployed version of the application. 

How to mitigate: Create a separate branch and do all of your changes there. Then once done, create a PR request labeling everything you have done and changed. Then the work must be tested by your other Dev. Once tested to be bug-free, PM can then check and approve the PR.

By doing this, we avoid the future risk of a bug-infested live application.