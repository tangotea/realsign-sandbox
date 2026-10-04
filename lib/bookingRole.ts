export function related<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export function bookingRole(serviceRole: string | undefined, providing: boolean) {
  return serviceRole === "interpreter" ? (providing ? "Interpreter" : "Client") : (providing ? "Tutor" : "Learner");
}

export function bookingRoleText(serviceRole: string | undefined, providing: boolean) {
  const role = bookingRole(serviceRole, providing);
  return `Your role: I am the ${role}${role === "Client" ? ". I booked an interpreter." : ""}`;
}
