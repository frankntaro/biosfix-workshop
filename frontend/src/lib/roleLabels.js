/** Role label for UI */
export function roleDisplayLine(role) {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "RECEPTION":
      return "Reception";
    case "TECHNICIAN":
      return "Technician";
    default:
      return role || "";
  }
}
