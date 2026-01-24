class RenameNameToTitleInTtips < ActiveRecord::Migration[7.2]
  def change
    rename_column :trips, :name, :title
  end
end
