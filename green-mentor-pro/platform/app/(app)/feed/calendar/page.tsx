import { redirect } from "next/navigation";

// The standalone calendar was absorbed into the Home dashboard's agenda view.
// Keep the route so old links land somewhere useful.
export default function CalendarPage() {
  redirect("/home");
}
