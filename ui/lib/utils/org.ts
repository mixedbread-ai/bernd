import { authClient } from "@/lib/auth";

/**
 * Simple slugify function
 */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Get smart default organization name based on email and user data
 */
function getDefaultOrgName(email: string, userName?: string): string {
	if (userName?.trim()) {
		return `${userName.trim()}'s Workspace`;
	}

	const username = email.split("@")[0] ?? email;
	const cleanUsername = username
		.split(/[._-]/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");

	return `${cleanUsername}'s Workspace`;
}

/**
 * Generate a unique slug by appending numbers if the base slug exists
 */
async function generateUniqueSlug(baseSlug: string): Promise<string> {
	let slug = baseSlug;
	let counter = 1;

	while ((await authClient.organization.checkSlug({ slug })).error) {
		slug = `${baseSlug}-${counter}`;
		counter++;
	}

	return slug;
}

/**
 * Get default organization name and slug with availability checking
 */
export async function getDefaultOrganization(
	email: string,
	userName: string | undefined,
): Promise<{ name: string; slug: string }> {
	const name = getDefaultOrgName(email, userName);
	const baseSlug = slugify(name);
	const slug = await generateUniqueSlug(baseSlug);

	return { name, slug };
}
