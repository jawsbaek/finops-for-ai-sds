import { redirect } from "next/navigation";
import { auth } from "~/server/auth";

export default async function Home() {
	const session = await auth();

	// Redirect to dashboard if logged in, otherwise to login
	if (session?.user) {
		redirect("/dashboard");
	} else {
		redirect("/login");
	}
}
