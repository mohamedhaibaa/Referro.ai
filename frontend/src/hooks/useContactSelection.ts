import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { setContactSelected } from "@/lib/api/contacts";
import { Contact } from "@/types/job";

export function useToggleContactSelection(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, isSelected }: { contactId: string; isSelected: boolean }) =>
      setContactSelected(jobId, contactId, isSelected),
    onMutate: async ({ contactId, isSelected }) => {
      await qc.cancelQueries({ queryKey: ["contacts", jobId] });
      const previous = qc.getQueryData<Contact[]>(["contacts", jobId]);
      if (previous) {
        qc.setQueryData<Contact[]>(
          ["contacts", jobId],
          previous.map((c) => (c.id === contactId ? { ...c, isSelected } : c))
        );
      }
      return { previous };
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["contacts", jobId], ctx.previous);
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.includes("Selection cap") || msg.includes("400")) {
        toast.error("You can only select up to 9 contacts");
      } else {
        toast.error("Couldn't update that. Try again?");
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["contacts", jobId] });
    },
  });
}
