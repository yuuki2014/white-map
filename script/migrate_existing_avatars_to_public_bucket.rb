puts "Start avatar migration"

User.joins(:avatar_attachment).find_each do |user|
  begin
    old_blob = user.avatar.blob
    old_key  = old_blob.key

    if old_blob.service_name == "cloudflare_public"
      puts "skip user=#{user.id} already migrated key=#{old_key}"
      next
    end

    ext = File.extname(old_blob.filename.to_s).downcase

    old_blob.open do |file|
      new_blob = ActiveStorage::Blob.create_and_upload!(
        io: file,
        filename: old_blob.filename.to_s,
        content_type: old_blob.content_type,
        key: "avatars/#{user.public_uid}/#{SecureRandom.uuid}#{ext}",
        service_name: "cloudflare_public"
      )

      user.avatar.attach(new_blob)
      puts "migrated user=#{user.id} old_key=#{old_key} new_key=#{new_blob.key}"
    end
  rescue => e
    puts "failed user=#{user.id} error=#{e.class} #{e.message}"
  end
end

puts "Done"
