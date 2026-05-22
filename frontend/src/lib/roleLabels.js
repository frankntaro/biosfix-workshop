/** Role label for UI */
export function roleDisplayLine(role) {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "RECEPTION":
      return "Receptionist";
    case "TECHNICIAN":
      return "Technician";
    default:
      return role || "";
  }
}

/** Main heading on the home dashboard page */
export function dashboardTitle(role) {
  switch (role) {
    case "ADMIN":
      return "Admin Dashboard";
    case "RECEPTION":
      return "Receptionist Dashboard";
    case "TECHNICIAN":
      return "Technician Dashboard";
    default:
      return "Dashboard";
  }
}

/** Short line under the dashboard title */
export function dashboardSubtitle(role, { scopedToTechnician = false } = {}) {
  switch (role) {
    case "ADMIN":
      return "Workshop overview, revenue, team workload, and activity";
    case "RECEPTION":
      return "Today's intakes, job queue, and customer operations";
    case "TECHNICIAN":
      return scopedToTechnician
        ? "Your assigned repairs — update status from here"
        : "Your assigned jobs";
    default:
      return "Overview";
  }
}

/** Sidebar / nav label for the dashboard link */
export function dashboardNavLabel(role) {
  switch (role) {
    case "ADMIN":
      return "Admin dashboard";
    case "RECEPTION":
      return "Receptionist dashboard";
    case "TECHNICIAN":
      return "Technician dashboard";
    default:
      return "Dashboard";
  }
}
