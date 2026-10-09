
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_events": {
                  Row: {
                    "actor_profile_id": string | null,"created_at": string,"detail": Json | null,"id": string,"kind": string,"manufacturer_id": string | null,"summary": string,"unit_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_profile_id"?: string | null,"created_at"?: string,"detail"?: Json | null,"id"?: string,"kind": string,"manufacturer_id"?: string | null,"summary": string,"unit_id"?: string | null
                  }
                  Update: {
                    "actor_profile_id"?: string | null,"created_at"?: string,"detail"?: Json | null,"id"?: string,"kind"?: string,"manufacturer_id"?: string | null,"summary"?: string,"unit_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_events_actor_profile_id_fkey"
      columns: ["actor_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_events_actor_profile_id_fkey"
      columns: ["actor_profile_id"]
isOneToOne: false
      referencedRelation: "v_shared_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_events_manufacturer_id_fkey"
      columns: ["manufacturer_id"]
isOneToOne: false
      referencedRelation: "manufacturers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_events_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "product_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_events_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "v_public_product_verification"
      referencedColumns: ["unit_id"]
    }
                  ]
                },"manufacturer_members": {
                  Row: {
                    "created_at": string,"manufacturer_id": string,"profile_id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"manufacturer_id": string,"profile_id": string,"role": string
                  }
                  Update: {
                    "created_at"?: string,"manufacturer_id"?: string,"profile_id"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "manufacturer_members_manufacturer_id_fkey"
      columns: ["manufacturer_id"]
isOneToOne: false
      referencedRelation: "manufacturers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "manufacturer_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "manufacturer_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "v_shared_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"manufacturers": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"logo_url": string | null,"name": string,"slug": string,"updated_at": string,"verified": boolean,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"logo_url"?: string | null,"name": string,"slug": string,"updated_at"?: string,"verified"?: boolean,"website"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"logo_url"?: string | null,"name"?: string,"slug"?: string,"updated_at"?: string,"verified"?: boolean,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"kind": string,"profile_id": string,"read_at": string | null,"recall_id": string | null,"severity": string,"title": string,"unit_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"profile_id": string,"read_at"?: string | null,"recall_id"?: string | null,"severity"?: string,"title": string,"unit_id"?: string | null
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"profile_id"?: string,"read_at"?: string | null,"recall_id"?: string | null,"severity"?: string,"title"?: string,"unit_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "v_shared_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recall_id_fkey"
      columns: ["recall_id"]
isOneToOne: false
      referencedRelation: "recalls"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "product_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "v_public_product_verification"
      referencedColumns: ["unit_id"]
    }
                  ]
                },"ownership_records": {
                  Row: {
                    "from_profile_id": string | null,"id": string,"initiated_by": string | null,"note": string | null,"to_profile_id": string | null,"transferred_at": string,"unit_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "from_profile_id"?: string | null,"id"?: string,"initiated_by"?: string | null,"note"?: string | null,"to_profile_id"?: string | null,"transferred_at"?: string,"unit_id": string
                  }
                  Update: {
                    "from_profile_id"?: string | null,"id"?: string,"initiated_by"?: string | null,"note"?: string | null,"to_profile_id"?: string | null,"transferred_at"?: string,"unit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ownership_records_from_profile_id_fkey"
      columns: ["from_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ownership_records_from_profile_id_fkey"
      columns: ["from_profile_id"]
isOneToOne: false
      referencedRelation: "v_shared_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ownership_records_to_profile_id_fkey"
      columns: ["to_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ownership_records_to_profile_id_fkey"
      columns: ["to_profile_id"]
isOneToOne: false
      referencedRelation: "v_shared_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ownership_records_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "product_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ownership_records_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "v_public_product_verification"
      referencedColumns: ["unit_id"]
    }
                  ]
                },"product_models": {
                  Row: {
                    "category": string,"created_at": string,"id": string,"image_path": string,"manufacturer_id": string,"name": string,"sku": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"id"?: string,"image_path"?: string,"manufacturer_id": string,"name": string,"sku": string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"id"?: string,"image_path"?: string,"manufacturer_id"?: string,"name"?: string,"sku"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_models_manufacturer_id_fkey"
      columns: ["manufacturer_id"]
isOneToOne: false
      referencedRelation: "manufacturers"
      referencedColumns: ["id"]
    }
                  ]
                },"product_units": {
                  Row: {
                    "created_at": string,"current_owner_profile_id": string | null,"id": string,"manufactured_at": string | null,"model_id": string,"registered_at": string,"serial_number": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_owner_profile_id"?: string | null,"id"?: string,"manufactured_at"?: string | null,"model_id": string,"registered_at"?: string,"serial_number": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"current_owner_profile_id"?: string | null,"id"?: string,"manufactured_at"?: string | null,"model_id"?: string,"registered_at"?: string,"serial_number"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_units_current_owner_profile_id_fkey"
      columns: ["current_owner_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_units_current_owner_profile_id_fkey"
      columns: ["current_owner_profile_id"]
isOneToOne: false
      referencedRelation: "v_shared_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_units_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "product_models"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string | null,"full_name": string,"id": string,"notification_prefs": NonNullable<Json>,"updated_at": string,"wallet_address": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name": string,"id": string,"notification_prefs"?: NonNullable<Json>,"updated_at"?: string,"wallet_address"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"notification_prefs"?: NonNullable<Json>,"updated_at"?: string,"wallet_address"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"recall_units": {
                  Row: {
                    "recall_id": string,"unit_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "recall_id": string,"unit_id": string
                  }
                  Update: {
                    "recall_id"?: string,"unit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recall_units_recall_id_fkey"
      columns: ["recall_id"]
isOneToOne: false
      referencedRelation: "recalls"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recall_units_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "product_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recall_units_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "v_public_product_verification"
      referencedColumns: ["unit_id"]
    }
                  ]
                },"recalls": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"issued_at": string | null,"manufacturer_id": string,"model_id": string | null,"required_action": string,"scope_kind": string,"serial_from": string | null,"serial_to": string | null,"severity": string,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"issued_at"?: string | null,"manufacturer_id": string,"model_id"?: string | null,"required_action": string,"scope_kind"?: string,"serial_from"?: string | null,"serial_to"?: string | null,"severity"?: string,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"issued_at"?: string | null,"manufacturer_id"?: string,"model_id"?: string | null,"required_action"?: string,"scope_kind"?: string,"serial_from"?: string | null,"serial_to"?: string | null,"severity"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recalls_manufacturer_id_fkey"
      columns: ["manufacturer_id"]
isOneToOne: false
      referencedRelation: "manufacturers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recalls_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "product_models"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_public_product_verification": {
                  Row: {
                    "category": string | null,"image_path": string | null,"is_recalled": boolean | null,"manufacturer_name": string | null,"manufacturer_verified": boolean | null,"model_name": string | null,"model_sku": string | null,"recall_id": string | null,"recall_issued_at": string | null,"recall_required_action": string | null,"recall_severity": string | null,"recall_title": string | null,"serial_number": string | null,"unit_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_shared_profiles": {
                  Row: {
                    "avatar_url": string | null,"full_name": string | null,"id": string | null,"wallet_masked": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "avatar_url"?: string | null,"full_name"?: string | null,"id"?: string | null,"wallet_masked"?: never
                         }
                        Update: {
                           "avatar_url"?: string | null,"full_name"?: string | null,"id"?: string | null,"wallet_masked"?: never
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "active_recalls_for_unit":
{ Args: { "p_unit_id": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"id": string,
"issued_at": string | null,
"manufacturer_id": string,
"model_id": string | null,
"required_action": string,
"scope_kind": string,
"serial_from": string | null,
"serial_to": string | null,
"severity": string,
"status": string,
"title": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "recalls"
        isOneToOne: false
        isSetofReturn: true
      } },
"auth_wallet_address":
{ Args: { "p_user_id"?: string }; Returns: string
                           },
"create_manufacturer":
{ Args: { "p_name": string,"p_slug": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"id": string,
"logo_url": string | null,
"name": string,
"slug": string,
"updated_at": string,
"verified": boolean,
"website": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "manufacturers"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_product_model":
{ Args: { "p_category": string,"p_image_path"?: string,"p_manufacturer_id": string,"p_name": string,"p_sku": string }; Returns: {
              "category": string,
"created_at": string,
"id": string,
"image_path": string,
"manufacturer_id": string,
"name": string,
"sku": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "product_models"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_profile":
{ Args: { "p_avatar_url"?: string,"p_full_name": string }; Returns: {
              "avatar_url": string | null,
"created_at": string,
"email": string | null,
"full_name": string,
"id": string,
"notification_prefs": NonNullable<Json>,
"updated_at": string,
"wallet_address": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"find_profile_by_wallet":
{ Args: { "p_wallet": string }; Returns: {
              "full_name": string,"id": string,"is_self": boolean,"wallet_masked": string
            }[]
                           },
"identity_wallet_address":
{ Args: { "p_identity_data": Json,"p_provider_id"?: string }; Returns: string
                           },
"is_manufacturer_member":
{ Args: { "p_manufacturer_id": string }; Returns: boolean
                           },
"is_manufacturer_staff":
{ Args: { "p_manufacturer_id": string }; Returns: boolean
                           },
"issue_recall":
{ Args: { "p_manufacturer_id": string,"p_model_id": string,"p_required_action": string,"p_scope_kind"?: string,"p_serial_from"?: string,"p_serial_to"?: string,"p_severity": string,"p_title": string,"p_unit_ids"?: (string)[] }; Returns: Json
                           },
"lookup_public_product":
{ Args: { "p_identifier": string }; Returns: {
              "category": string,"image_path": string,"is_recalled": boolean,"manufacturer_id": string,"manufacturer_name": string,"manufacturer_verified": boolean,"model_id": string,"model_name": string,"model_sku": string,"recall_id": string,"recall_issued_at": string,"recall_required_action": string,"recall_severity": string,"recall_title": string,"serial_number": string,"unit_id": string
            }[]
                           },
"manufacturer_member_role":
{ Args: { "p_manufacturer_id": string }; Returns: string
                           },
"mask_wallet":
{ Args: { "p_address": string }; Returns: string
                           },
"recall_affected_owner_ids":
{ Args: { "p_recall_id": string }; Returns: string[]
                           },
"recall_affected_unit_count":
{ Args: { "p_recall_id": string }; Returns: number
                           },
"recallrelay_auth_diagnostic":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"recallrelay_health":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"register_product_unit":
{ Args: { "p_initial_owner_wallet"?: string,"p_manufactured_at"?: string,"p_model_id": string,"p_serial_number": string }; Returns: {
              "created_at": string,
"current_owner_profile_id": string | null,
"id": string,
"manufactured_at": string | null,
"model_id": string,
"registered_at": string,
"serial_number": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "product_units"
        isOneToOne: true
        isSetofReturn: false
      } },
"transfer_product_ownership":
{ Args: { "p_note"?: string,"p_recipient_wallet": string,"p_unit_id": string }; Returns: {
              "created_at": string,
"current_owner_profile_id": string | null,
"id": string,
"manufactured_at": string | null,
"model_id": string,
"registered_at": string,
"serial_number": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "product_units"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
