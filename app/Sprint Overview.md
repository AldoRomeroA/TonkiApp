Developer 1 – Database & Backend
- Extend DB schema to include expire_date for tonki points.
- Implement expiration logic per establishment.
- Create migration scripts for existing data.
- Add backend API endpoints for CRUD operations on expiration rules.
- Write unit tests for DB changes.
- Document unit tests in shared testing doc.
- Commit & push changes into personal branch.

Developer 2 – Admin Config Interface
- Build admin UI for configuring tonki points expiration.
- Add wallet management interface (CRUD).
- Implement % cashback configuration UI.
- Add rules configuration for airdrop.
- Add rules configuration for cashback.
- Write unit tests for UI components.
- Commit & push changes into personal branch.

Developer 3 – QR Interfaces
- Create user-facing QR generation interface.
- Integrate QR with wallet and tonki points.
- Build admin interface to scan QR codes.
- Implement cashback logic triggered by QR scan.
- Add error handling and feedback messages.
- Write unit tests for QR workflows.
- Commit & push changes into personal branch.

Developer 4 – User Feed & Posts
- Build user interface feed.
- Connect feed to backend posts API.
- Implement infinite scroll/pagination.
- Create admin interface for post creation.
- Add image/file upload support.
- Write unit tests for feed & posts.
- Commit & push changes into personal branch.

Developer 5 – Admin Dashboard Enhancements
- Extend dashboard with “Clients List” segment.
- Display clients with transaction history.
- Add filters (date range, establishment, transaction type).
- Implement export functionality (CSV/Excel).
- Add pagination and search.
- Write unit tests for dashboard segment.
- Commit & push changes into personal branch.

Developer 6 – Security & Authorization
- Build admin interface for cashback authorization.
- Implement approval workflow (pending → approved/denied).
- Add role-based access control.
- Integrate security checks to prevent abuse.
- Write audit logs for authorization actions.
- Write unit tests for authorization logic.
- Commit & push changes into personal branch.

Project Manager Tasks
- Coordinate sprint planning and daily standups.
- Track progress across all developer tasks.
- Review acceptance criteria compliance.
- Merge approved developer branches into main.
- Prepare release notes and documentation.
- Oversee staging and production deployment.
- Monitor post-release logs and feedback.

Principal Engineer Tasks
- Create personal branches for each developer.
- Review commits and pull requests.
- Approve or deny commits based on acceptance criteria.
- Ensure coding standards and best practices.
- Validate unit test coverage before merge.
- Maintain CI/CD pipeline integrity.
- Provide technical guidance and resolve blockers.

Shared QA & Release Tasks
- Integration testing across all modules.
- End-to-end testing of QR → cashback → feed workflows.
- Security & performance testing.
- Staging deployment and UAT.
- Production release with rollback plan.
- Post-release monitoring and bug fixes

Sprint Summary (April 20 – May 1)
This sprint involves eight roles: six developers, one project manager, and one principal engineer. The team will deliver new features across database, admin interfaces, user interfaces, security, feed and posts, and dashboard enhancements. Each developer is responsible for implementing their assigned features, writing unit tests, documenting those tests, and committing changes into their personal branch created by the principal engineer. All work must meet acceptance criteria before being merged.

The principal engineer will create personal branches, review commits, enforce coding standards, and approve or deny merges. The project manager will coordinate sprint activities, track progress, oversee acceptance criteria compliance, and merge approved branches into the main branch. Shared responsibilities include integration testing, end-to-end testing, security and performance validation, staging deployment, production release, and post-release monitoring.
In summary, the sprint covers feature development, unit testing, documentation, branch management, commit approval, integration testing, and deployment, ensuring a complete cycle from coding to release.
