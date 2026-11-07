# Unitmix: dat ten component va tag theo tang sau khi nhap tep .dae cua Unitmix.
# SketchUp bo qua ten cua instance_node nen sau khi nhap chi con Component1, Component2...
# Cach dung: chep tep nay vao thu muc Plugins, mo SketchUp, nhap .dae, chon Extensions > Unitmix > Dat ten tang.
# Hoac Window > Ruby Console: load 'duong/dan/unitmix_dat_ten.rb' roi UnitmixDatTen.chay
require 'sketchup.rb'

module UnitmixDatTen
  M = 39.37007874 # inch / m

  # Toa la component co it nhat 2 con la component va khong co mat truc tiep.
  def self.la_toa?(d)
    con = d.entities.grep(Sketchup::ComponentInstance)
    con.size >= 2 && d.entities.grep(Sketchup::Face).empty? && con.all? { |c| c.definition.entities.grep(Sketchup::ComponentInstance).empty? }
  end

  def self.chay(model = Sketchup.active_model)
    model.start_operation('Unitmix dat ten tang', true)
    toa = model.definitions.to_a.select { |d| !d.image? && d.count_instances > 0 && la_toa?(d) }
    so_tang = 0
    toa.each_with_index do |d, i|
      ten_toa = toa.size > 1 ? "Bo cuc #{i + 1}" : 'Toa'
      d.name = model.definitions.unique_name(ten_toa)
      tang = d.entities.grep(Sketchup::ComponentInstance).sort_by { |c| c.transformation.origin.z }
      dem_dinh_nghia = Hash.new(0)
      tang.each { |c| dem_dinh_nghia[c.definition] += 1 }
      tang.each_with_index do |c, k|
        cao = (c.transformation.origin.z / M).round(2)
        ten = k == tang.size - 1 ? 'Mai - tum' : "Tang #{k + 1}"
        c.name = "#{ten} (+#{cao} m)"
        c.layer = model.layers.add(ten)
        so_tang += 1
        if dem_dinh_nghia[c.definition] > 1
          c.definition.name = model.definitions.unique_name("#{d.name} - Tang dien hinh") if c.definition.name =~ /^Component/
        elsif c.definition.name =~ /^Component/
          c.definition.name = model.definitions.unique_name("#{d.name} - #{ten}")
        end
      end
    end
    model.commit_operation
    "Da dat ten #{toa.size} toa, #{so_tang} tang"
  end

  unless file_loaded?(__FILE__)
    m = UI.menu('Extensions').add_submenu('Unitmix')
    m.add_item('Dat ten tang') { UI.messagebox(chay) }
    file_loaded(__FILE__)
  end
end
