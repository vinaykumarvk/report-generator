import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";

type Template = {
  id: string;
  name: string;
  description?: string;
  workspaceId?: string | null;
  [key: string]: unknown;
};

function mapRow<T>(row: any): T {
  return row as T;
}

function handleSupabaseError(error: unknown, context: string) {
  if (error) {
    assertNoSupabaseError(error, context);
  }
}

export class SupabaseStorage {
  async getTemplate(templateId: string): Promise<Template | null> {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .single();
    
    if (error) {
      handleSupabaseError(error, "getTemplate");
    }
    
    return data ? mapRow<Template>(data) : null;
  }

  async getTemplatesByType(type: string): Promise<Template[]> {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("type", type)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    
    if (error) {
      handleSupabaseError(error, "getTemplatesByType");
    }
    
    return (data || []).map(mapRow<Template>);
  }
}
