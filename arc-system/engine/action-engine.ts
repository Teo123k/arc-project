export function evaluateAction(intention: string, friction: string | null) {
  if (!friction) {
    return {
      title: "Define the first measurable step",
      description: "Break intention into one small actionable task you can complete in 24 hours."
    };
  }

  if (friction.toLowerCase().includes("no audience")) {
    return {
      title: "Audience Research",
      description: "Identify your target audience and list 3 groups most aligned with your retreat theme."
    };
  }

  if (friction.toLowerCase().includes("money")) {
    return {
      title: "Funding Strategy",
      description: "List 3 potential funding options: presale tickets, partners, investors."
    };
  }

  return {
    title: "Clarify the obstacle",
    description: "Write what is stopping you and what support would solve it."
  };
}
